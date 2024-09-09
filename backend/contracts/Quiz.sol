// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {
    Sapphire
} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {
    EIP155Signer
} from "@oasisprotocol/sapphire-contracts/contracts/EIP155Signer.sol";
import {NftReward} from "./NftReward.sol";

/**
 * @title Quiz
 * @notice A contract that allows creating quizzes with questions and answers.
 * Pays out tokens or generates NFT rewards for correctly solving the quiz.
 */
contract Quiz {
    uint256 public constant COUPON_VALID = type(uint256).max - 1;
    uint256 public constant COUPON_REMOVED = type(uint256).max - 2;

    struct QuizQuestion {
        // Question.
        string question;
        // List of possible answers. The first answer is always
        // the correct one.
        // Answers will be randomized per-user.
        string[] choices;
    }

    // This struct is encrypted on-chain and provided as a proof for claiming the reward.
    // Since it's encrypted, it also hides the coupon and the address, useful for sending
    // over plain gasless transaction.
    struct PayoutCertificate {
        string coupon;
        address addr;
    }

    // Keypair for gasless transactions.
    struct EthereumKeypair {
        address addr;
        bytes32 secret;
        uint64 nonce;
    }

    // Owner of the contract.
    address private _owner;
    // Encryption key for encrypting payout certificates.
    bytes32 private _key;
    // NFT contract address.
    address public nftAddress;
    // Reference to NFT metadata hash.
    bytes32 private _nftMetadataHash;

    // List of questions.
    QuizQuestion[] private _questions;
    // Total number of choices. Used for generating the permutation vector.
    uint256 private _totalChoices;
    // Status of coupons.
    // COUPON_VALID for valid coupon, COUPON_REMOVED for removed.
    mapping(string => uint256) private _coupons;
    // Stores all coupons that ever existed. Used for traversing the mapping.
    string[] private _allCoupons;
    // Reward amount in wei.
    uint256 public payoutReward;
    // Keypair used for gasless transactions (optional).
    EthereumKeypair private _kp;

    error OnlyOwnerCanCallFunction(address caller);
    error InvalidCoupon(string coupon);
    error InvalidNumberOfAnswersError(uint256 provided, uint256 expected);
    error InvalidCouponError(string coupon);
    error PayoutFailedError();
    error ZeroAddressError(address owner);

    modifier onlyOwner() {
        if (!(msg.sender == _owner)) {
            revert OnlyOwnerCanCallFunction(msg.sender);
        }
        _;
    }

    modifier validCoupon(string memory coupon) {
        if (!(_coupons[coupon] == COUPON_VALID) && _owner != msg.sender) {
            revert InvalidCoupon(coupon);
        }
        _;
    }

    constructor() payable {
        _owner = msg.sender;
        _key = bytes32(Sapphire.randomBytes(32, ""));
    }

    /**
     * @notice Adds a new question to the quiz.
     * @param question Question to add.
     * @param choices List of possible answers. 
        The first answer is always correct.
     */
    function addQuestion(
        string memory question,
        string[] memory choices
    ) external onlyOwner {
        _questions.push(QuizQuestion(question, choices));
        _totalChoices += choices.length;
    }

    /**
     * @notice Clears all questions from the quiz.
     */
    function clearQuestions() external onlyOwner {
        delete _questions;
        _totalChoices = 0;
    }

    /**
     * @notice Sets the question at the given index.
     * @param questionIndex Index of the question to set.
     * @param question New question.
     * @param choices New choices.
     */
    function setQuestion(
        uint256 questionIndex,
        string memory question,
        string[] memory choices
    ) external onlyOwner {
        _totalChoices -= _questions[questionIndex].choices.length;
        _questions[questionIndex] = QuizQuestion(question, choices);
        _totalChoices += choices.length;
    }

    /**
     * @notice Sets the native token reward amount for solving the quiz.
     */
    function setPayoutReward(uint256 reward) external onlyOwner {
        payoutReward = reward;
    }

    /**
     * @notice Adds new coupons to the quiz.
     * @param coupons Coupons to add.
     */
    function addCoupons(string[] calldata coupons) external onlyOwner {
        for (uint256 i = 0; i < coupons.length; i++) {
            if (_coupons[coupons[i]] == 0) {
                _allCoupons.push(coupons[i]);
            }
            _coupons[coupons[i]] = COUPON_VALID;
        }
    }

    /**
     * @notice Removes a coupon from the quiz.
     * @param coupon Coupon to remove.
     */
    function removeCoupon(string memory coupon) external onlyOwner {
        _coupons[coupon] = COUPON_REMOVED;
    }

    /**
     * @notice Returns all coupons and their status.
     */
    function getCoupons()
        external
        view
        onlyOwner
        returns (string[] memory, uint256[] memory)
    {
        uint256[] memory status = new uint256[](_allCoupons.length);
        for (uint256 i = 0; i < _allCoupons.length; i++) {
            status[i] = _coupons[_allCoupons[i]];
        }
        return (_allCoupons, status);
    }

    /**
     * @notice Returns the number of valid coupons.
     */
    function countCoupons() external view onlyOwner returns (uint256, uint256) {
        uint256 cnt;
        for (uint256 i = 0; i < _allCoupons.length; i++) {
            if (_coupons[_allCoupons[i]] == COUPON_VALID) {
                cnt++;
            }
        }
        return (cnt, _allCoupons.length);
    }

    /**
     * @notice Generates a permutation vector for the given coupon.
     * @param coupon Coupon to generate the permutation vector for.
     */
    function getPermutationVector(
        string memory coupon
    ) private view returns (uint8[] memory) {
        uint8[] memory pv = new uint8[](_totalChoices);

        uint256 k = 0; // Number of processed choices in total.
        for (uint256 i = 0; i < _questions.length; i++) {
            bytes32 seed = keccak256(abi.encode(_key, coupon, i));
            // Enumerate choices.
            for (uint8 j = 0; j < _questions[i].choices.length; j++) {
                pv[k + j] = j;
            }
            // Permute choices based on the seed.
            for (uint256 j = 0; j < _questions[i].choices.length; j++) {
                uint8 permChoiceIdx = uint8(
                    uint8(seed[j % seed.length]) % _questions[i].choices.length
                );
                // Swap permChoiceIdx with j.
                uint8 tmp = pv[k + permChoiceIdx];
                pv[k + permChoiceIdx] = pv[k + j];
                pv[k + j] = tmp;
            }
            k += _questions[i].choices.length;
        }
        return pv;
    }

    /**
     * @notice Returns the correct choices for the given coupon.
     * @param coupon Coupon to fetch the correct choices for.
     */
    function getCorrectChoices(
        string memory coupon
    ) private view returns (uint8[] memory) {
        uint8[] memory pv = getPermutationVector(coupon);
        uint8[] memory correctChoices = new uint8[](_questions.length);
        uint256 k = 0; // Number of processed choices in total.
        for (uint256 i = 0; i < _questions.length; i++) {
            for (uint8 j = 0; j < _questions[i].choices.length; j++) {
                if (pv[k + j] == 0) {
                    correctChoices[i] = j;
                    break;
                }
            }
            k += _questions[i].choices.length;
        }
        return correctChoices;
    }

    /**
     * @notice Returns the questions for the given coupon.
     * @param coupon Coupon to fetch the questions for.
     */
    function getQuestions(
        string memory coupon
    ) external view validCoupon(coupon) returns (QuizQuestion[] memory) {
        // Do not randomize answers, if the owner is fetching them.
        if (msg.sender == _owner) {
            return _questions;
        }

        // Randomize question choices.
        QuizQuestion[] memory qs = new QuizQuestion[](_questions.length);
        uint8[] memory pv = getPermutationVector(coupon);

        uint256 k = 0; // Number of processed choices in total.
        for (uint256 i = 0; i < _questions.length; i++) {
            string[] memory newChoices = new string[](
                _questions[i].choices.length
            );
            for (uint256 j = 0; j < _questions[i].choices.length; j++) {
                newChoices[j] = _questions[i].choices[pv[k + j]];
            }
            qs[i] = QuizQuestion(_questions[i].question, newChoices);
            k += _questions[i].choices.length;
        }

        return qs;
    }

    /**
     * @notice Enable gasless mode by using the provided keypair.
     * @param addr Address of the gasless account.
     * @param secretKey Secret key of the gasless account.
     * @param nonce Nonce of the gasless account.
     */
    function setGaslessKeyPair(
        address addr,
        bytes32 secretKey,
        uint64 nonce
    ) external onlyOwner {
        _kp = EthereumKeypair(addr, secretKey, nonce);
    }

    /**
     * @notice Returns the gasless keypair of the account
         that pays for the gas.
     */
    function getGaslessKeyPair()
        external
        view
        returns (address, bytes32, uint64)
    {
        return (_kp.addr, _kp.secret, _kp.nonce);
    }

    /**
     * @notice Checks the provided answers for the given coupon.
     * @param coupon Coupon to check the answers for.
     * @param answers Answers to check.
     * @param payoutAddr Address to send the reward to.
     */
    function checkAnswers(
        string memory coupon,
        uint8[] memory answers,
        address payoutAddr
    ) external view validCoupon(coupon) returns (bool[] memory, bytes memory) {
        if (answers.length != _questions.length) {
            revert InvalidNumberOfAnswersError(
                answers.length,
                _questions.length
            );
        }
        bool allCorrect = true;
        bool[] memory correctVector = new bool[](_questions.length);
        uint8[] memory questionsCorrectChoices = getCorrectChoices(coupon);
        for (uint256 i = 0; i < _questions.length; i++) {
            bool answerCorrect = (questionsCorrectChoices[i] == answers[i]);
            correctVector[i] = answerCorrect;
            allCorrect = (allCorrect && answerCorrect);
        }
        if (!allCorrect || payoutAddr == address(0)) {
            return (correctVector, "");
        }

        bytes memory pcEncoded = abi.encode(
            PayoutCertificate(coupon, payoutAddr)
        );
        bytes memory encPc = Sapphire.encrypt(_key, 0, pcEncoded, "");

        // If gasless mode is enabled, generate the proxy transaction.
        if (_kp.addr != address(0)) {
            bytes memory gaslessTx = EIP155Signer.sign(
                _kp.addr,
                _kp.secret,
                EIP155Signer.EthTx({
                    nonce: _kp.nonce,
                    gasPrice: 100_000_000_000,
                    gasLimit: 300_000,
                    to: address(this),
                    value: 0,
                    data: abi.encodeCall(this.claimReward, encPc),
                    chainId: block.chainid
                })
            );

            return (correctVector, gaslessTx);
        }

        return (correctVector, encPc);
    }

    /**
     * @notice Claims the reward for the given payout certificate.
     * @param encPayoutCertificate Encrypted payout certificate.
     */
    function claimReward(bytes memory encPayoutCertificate) external {
        bytes memory pcEncoded = Sapphire.decrypt(
            _key,
            0,
            encPayoutCertificate,
            ""
        );
        PayoutCertificate memory pc = abi.decode(
            pcEncoded,
            (PayoutCertificate)
        );

        // Check coupon validity.
        if (_coupons[pc.coupon] != COUPON_VALID) {
            revert InvalidCouponError(pc.coupon);
        }

        // If nft address is set and , mint NFT
        if (nftAddress != address(0)) {
            NftReward(nftAddress).mint(pc.addr, _nftMetadataHash);
        }
        // If payoutReward is set, make a payout.
        if (payoutReward > 0) {
            (bool success, ) = pc.addr.call{value: payoutReward}("");
            if (!success) {
                revert PayoutFailedError();
            }
        }

        // Invalidate coupon.
        _coupons[pc.coupon] = block.number;

        // Increase nonce, for gasless tx.
        if (msg.sender == _kp.addr) {
            _kp.nonce++;
        }
    }

    /**
     * @notice Sets the NFT contract address and
     *  generates the SVG image for the quiz.
     * @param nftAddr NFT contract address.
     */
    function setNftAddress(address nftAddr) external onlyOwner {
        nftAddress = nftAddr;
    }

    /**
     * @notice Sets the custom json metadata for the quiz.
     * @param jsonMetadata JSON metadata to add to the NftReward contract.
     */
    function storeNFT(string calldata jsonMetadata) external onlyOwner {
        _nftMetadataHash = NftReward(nftAddress).storeNft(jsonMetadata);
    }

    /**
     * @notice Reclaims the funds from the contract.
     * @param addr Address to send the funds to.
     */
    function reclaimFunds(address addr) external onlyOwner {
        (bool success, ) = addr.call{value: address(this).balance}("");
        if (!success) {
            revert PayoutFailedError();
        }
    }

    receive() external payable {}
}
