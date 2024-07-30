// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {
    ERC721, ERC721Enumerable
} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {
    Base64
} from "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title OasisReward
 * @notice An ERC721 contract that allows minting of NFT rewards for 
 * Oasis Quizzes.
 * Contains functions to mint new NFTs, generate SVG images, 
 * and retrieve token data.
 */
contract NftReward is ERC721Enumerable {

    /// @notice Array of metadata JSON hashes. 
    /// @dev Used for storage efficient mapping to tokenURI.
    bytes32[] private _tokenURIHashes;

    // Mapping from user address to list of owned token IDs
    mapping(address => uint256[]) private _ownedTokens;
    // Whitelisted msg.sender accounts
    mapping(address => bool) private _allowMint;
    // Mapping from JSON hash to JSON.
    mapping(bytes32 => string) public tokenURIs;

    address private _owner;

    error OnlyOwnerCanCallFunction(address caller);
    error AddressNotAllowed(address caller);
    error IncorrectImageError(string base64Encoded);
    error TokenNotExistError(uint256 tokenId);
    error ZeroAddressError(address owner);

    modifier onlyOwner() {
        if (msg.sender != _owner) {
            revert OnlyOwnerCanCallFunction(msg.sender);
        }
        _;
    }

    modifier onlyAllowMint() {
        if (!_allowMint[msg.sender]) {
            revert AddressNotAllowed(msg.sender);
        }
        _;
    }

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        _owner = msg.sender;
    }

    function addAllowMint(address _address) public onlyOwner {
        _allowMint[_address] = true;
    }

    function removeAllowMint(address _address) public onlyOwner {
        _allowMint[_address] = false;
    }

    /**
     * @notice Mint new NFT reward
     * @param to address to mint the NFT to
     * @param metaDataHash hash of the JSON metadata
     */
    function mint(address to, bytes32 metaDataHash) public onlyAllowMint {
        uint256 tokenId = totalSupply();
        _tokenURIHashes.push(metaDataHash);
        _safeMint(to, tokenId);
        _ownedTokens[to].push(tokenId);
    }

    /**
     * @notice Update the image ID for a given token
     * @param jsonString json metadata string to store
     */
    function storeNft(
        string calldata jsonString
    ) public onlyAllowMint returns (bytes32) {
        bytes32 jsonHash = keccak256(abi.encodePacked(jsonString));
        tokenURIs[jsonHash] = jsonString;
        return jsonHash;
    }

    /**
     * @notice Returns the list of token IDs owned by an address
     * @param owner address of the owner
     */
    function getOwnedTokens(
        address owner
    ) public view returns (uint256[] memory) {
        if (owner == address(0)) {
            revert ZeroAddressError(owner);
        }
        return _ownedTokens[owner];
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        if (!_exists(id)) {
            revert TokenNotExistError(id);
        }
        // If the tokenURI is not set, return empty string
        if (bytes(tokenURIs[_tokenURIHashes[id]]).length == 0) {
            return "";
        } else {
            string memory json = Base64.encode(
                bytes(string(tokenURIs[_tokenURIHashes[id]]))
            );
            return
                string(abi.encodePacked("data:application/json;base64,", json));
        }
    }
}
