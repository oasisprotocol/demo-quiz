// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract OasisReward is ERC721Enumerable {
    // Mapping from token ID to IPFS URI
    mapping(uint256 => string) private _tokenURIs;

    // Mapping from user address to list of owned token IDs
    mapping(address => uint256[]) private _ownedTokens;
    // Whitelisted msg.sender accounts
    mapping(address => bool) _allowMint;


    // Contract owner
    address private _owner;

    
    modifier onlyOwner {
        require(msg.sender == _owner, "Only owner can call this function");
        _;
    }

    modifier onlyAllowMint {
        require(_allowMint[msg.sender], "Address not allowed");
        _;
    }

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
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
     * @param base64EncodedSVG base64 encoded SVG image
     */
    // Function to mint new tokens
    function mint(address to, string calldata base64EncodedSVG) public onlyAllowMint {
        require(bytes(base64EncodedSVG).length > 0, "Token URI not set");
        uint256 tokenId = totalSupply();
        _tokenURIs[tokenId] = base64EncodedSVG;
        _safeMint(to, tokenId);
        _ownedTokens[to].push(tokenId); // Add the tokenId to the list of owned tokens for the address 'to'
    }

    /**
     * 
     * @notice Generate a simple SVG image that can be stored on-chain
     * @param quizID unique identifier for the quiz contract
     */
    function generateComplexSVG(
        uint32 quizID
    ) public view onlyAllowMint returns (string memory) {

        // Use tokenId to generate some unique details for the SVG
        // For simplicity, let's change the circle's color based on the tokenId's parity
        string memory circleColor = quizID % 2 == 0 ? "blue" : "red";

        // SVG parts concatenated with dynamic data
        string memory svg = string(abi.encodePacked(
            "<svg width=\"200\" height=\"200\" xmlns=\"http://www.w3.org/2000/svg\">",
            "<circle cx=\"100\" cy=\"100\" r=\"50\" fill=\"", circleColor, "\" />",
            "</svg>"
        ));

        // Encode the entire SVG string to Base64
        string memory base64EncodedSVG = Base64.encode(bytes(svg));

        // Return the data URI for the SVG image
        return
            string(
                abi.encodePacked("data:image/svg+xml;base64,", base64EncodedSVG)
            );
    }

    /**
     * 
     * @notice Returns the SVG base64 encoded string for a tokenID
     * @param tokenId unique identifier for the token
     * 
     */
    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        require(
            _exists(tokenId),
            "ERC721URIStorage: URI set of nonexistent token"
        );
        return _tokenURIs[tokenId];
    }

    /**
     * 
     * @notice Returns the list of token IDs owned by an address
     * @param owner address of the owner
     */
    function getOwnedTokens(address owner) public view returns (uint256[] memory) {
        require(owner != address(0), "Address cannot be the zero address.");
        return _ownedTokens[owner];
    }
}
