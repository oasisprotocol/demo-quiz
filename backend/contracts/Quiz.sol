// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Sapphire} from "@oasisprotocol/sapphire-contracts/contracts/Sapphire.sol";
import {EIP155Signer} from "@oasisprotocol/sapphire-contracts/contracts/EIP155Signer.sol";
import {OasisReward} from "./OasisReward.sol";

contract Quiz {
    uint256 public constant COUPON_VALID = type(uint256).max - 1;
    uint256 public constant COUPON_REMOVED = type(uint256).max - 2;

    struct QuizQuestion {
        // Question.
        string question;
        // List of possible answers. The first answer is always the correct one.
        // Answers will be randomized per-user.
        string[] choices;
    }

    // This struct is encrypted on-chain and provided as a proof for claiming the reward.
    // Since it's encrypted, it also hides the coupon and the address, useful for sending over plain gasless transaction.
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
    // Quiz ID for generating NFT images
    uint32 private _quizID;
    // Base64 svg image for this quiz instance
    string private _svgImage;
    // NFT contract address
    address private _nftAddress;
    // List of questions.
    QuizQuestion[] private _questions;
    // Total number of choices. Used for generating the permutation vector.
    uint256 private _totalChoices;
    // Status of coupons. COUPON_VALID for valid coupon, COUPON_REMOVED for removed, block number for spent.
    mapping(string => uint256) private _coupons;
    // Stores all coupons that ever existed. Used for traversing the mapping.
    string[] private _allCoupons;
    // Reward amount in wei.
    uint256 private _reward;
    // Keypair used for gasless transactions (optional).
    EthereumKeypair private _kp;

    // Flag for making a ROSE payout
    bool internal _makePayoutNative = true;
    // Flag for making a NFT payout
    bool internal _makePayoutNFT = true;

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

    // Adds an new question with given choices and the correct one.
    function addQuestion(
        string memory question,
        string[] memory choices
    ) external onlyOwner {
        _questions.push(QuizQuestion(question, choices));
        _totalChoices += choices.length;
    }

    // Removes all questions.
    function clearQuestions() external onlyOwner {
        delete _questions;
        _totalChoices = 0;
    }

    // Updates the existing question.
    function setQuestion(
        uint256 questionIndex,
        string memory question,
        string[] memory choices
    ) external onlyOwner {
        _totalChoices -= _questions[questionIndex].choices.length;
        _questions[questionIndex] = QuizQuestion(question, choices);
        _totalChoices += choices.length;
    }

    // Sets the payout reward for correctly solving the quiz.
    function setReward(uint256 reward) external onlyOwner {
        _reward = reward;
    }

    // Gets the payout reward for correctly solving the quiz.
    function getReward() external view onlyOwner returns (uint256) {
        return _reward;
    }

    // Returns true, if there is any kind of a reward for solving the quiz.
    function isReward() external view returns (bool) {
        return _reward != 0;
    }

    // Registers coupons eligible for solving the quiz and claiming the reward.
    function addCoupons(string[] calldata coupons) external onlyOwner {
        for (uint256 i = 0; i < coupons.length; i++) {
            if (_coupons[coupons[i]] == 0) {
                _allCoupons.push(coupons[i]);
            }
            _coupons[coupons[i]] = COUPON_VALID;
        }
    }

    // Invalidates existing coupon.
    function removeCoupon(string memory coupon) external onlyOwner {
        _coupons[coupon] = COUPON_REMOVED;
    }

    // Returns all coupons.
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

    // Counts still valid coupons.
    function countCoupons() external view onlyOwner returns (uint256, uint256) {
        uint256 cnt;
        for (uint256 i = 0; i < _allCoupons.length; i++) {
            if (_coupons[_allCoupons[i]] == COUPON_VALID) {
                cnt++;
            }
        }
        return (cnt, _allCoupons.length);
    }

    // Generates the permutation vector for all question choices.
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

    // Return the index of the correct choice for all questions.
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

    // Find and return the questions providing valid coupon.
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

    // Enable gasless mode by using the provided keypair.
    function setGaslessKeyPair(
        address addr,
        bytes32 secretKey,
        uint64 nonce
    ) external onlyOwner {
        _kp = EthereumKeypair(addr, secretKey, nonce);
    }

    // Returns the gasless keypair of the account that pays for the gas.
    function getGaslessKeyPair()
        external
        view
        returns (address, bytes32, uint64)
    {
        return (_kp.addr, _kp.secret, _kp.nonce);
    }

    // Check provided answers and return the array of correct submissions.
    // If all the answers are correct and the payout address is provided, returns a payout certificate that can be used to claim the reward.
    // Generates gasless transaction, if gasless keypair is set.
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
        if (!allCorrect || payoutAddr == address(0) || _reward == 0) {
            return (correctVector, "");
        }

        // Encode and encrypt a payout certificate.
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
                    gasLimit: 1_000_000,
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

    // Claim the reward given the payout certificate.
    function claimReward(bytes memory encPayoutCertificate) external {
        // Decrypt, decode.
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

        // Make a payout.
        (bool success, ) = pc.addr.call{value: _reward}("");
        if (!success) {
            revert PayoutFailedError();
        }

        if (_makePayoutNFT) {
            // Mint NFT
            OasisReward(getNft()).mint(pc.addr, _svgImage);
        }

        // Invalidate coupon.
        _coupons[pc.coupon] = block.number;

        // Increase nonce, for gasless tx.
        if (msg.sender == _kp.addr) {
            _kp.nonce++;
        }
    }

    // Sets the flag for making a ROSE payout and the flag for making a NFT payout
    function setPayoutFlags(
        bool makePayoutNative,
        bool makePayoutNFT
    ) external onlyOwner {
        _makePayoutNative = makePayoutNative;
        _makePayoutNFT = makePayoutNFT;
    }

    // Adds the IDs of the NFT contract to the Quiz contract
    function setNft(address nftAddress) external onlyOwner {
        _quizID = uint32(block.number);
        _svgImage = OasisReward(nftAddress).generateComplexSVG(_quizID);
        _nftAddress = nftAddress;
    }

    // Function to get the deployed ERC721 contract instance
    function getNft() public view returns (address) {
        if (_nftAddress == address(0)) {
            revert ZeroAddressError(_nftAddress);
        }
        return _nftAddress;
    }

    // Reclaims contract funds to given address.
    function reclaimFunds(address addr) external onlyOwner {
        (bool success, ) = addr.call{value: address(this).balance}("");
        if (!success) {
            revert PayoutFailedError();
        }
    }

    receive() external payable {}
}
