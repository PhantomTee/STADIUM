// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Mints EliminationBadge (type 0) and ChampionNFT (type 1) with simple JSON metadata.
///         tokenURI returns base64-encoded JSON; image URL is derived from a configurable baseURI.
///         Only the ConvictionVault may mint.
contract StadiumNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 private _tokenIdCounter;
    address public convictionVault;

    /// @notice Optional base URI for off-chain images (e.g. IPFS gateway or CDN).
    ///         If empty, tokenURI returns pure on-chain JSON without an image field.
    string public imageBaseURI;

    struct TokenData {
        uint8   tokenType;      // 0 = EliminationBadge, 1 = ChampionNFT
        string  team;
        uint256 depositAmount;
        uint256 totalEarned;    // for champion NFT
        string  round;          // for elimination badge
        uint256 mintTime;
    }

    mapping(uint256 => TokenData) public tokenData;

    event EliminationBadgeMinted(address indexed to, string team, uint256 tokenId);
    event ChampionNFTMinted(address indexed to, string team, uint256 tokenId);

    modifier onlyVault() {
        require(msg.sender == convictionVault, "StadiumNFT: not vault");
        _;
    }

    constructor(address initialOwner) ERC721("STADIUM NFT", "STDM") Ownable(initialOwner) {}

    // ─────────────────────────────── Admin ───────────────────────────────

    function setConvictionVault(address _vault) external onlyOwner {
        require(_vault != address(0), "StadiumNFT: zero vault");
        convictionVault = _vault;
    }

    /// @notice Set base URI for token images. Set to empty string to disable image field.
    function setImageBaseURI(string calldata _uri) external onlyOwner {
        imageBaseURI = _uri;
    }

    // ─────────────────────────────── Mint ───────────────────────────────

    function mintChampionNFT(
        address to,
        string memory team,
        uint256 depositAmount,
        uint256 totalEarned
    ) external onlyVault returns (uint256) {
        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        tokenData[tokenId] = TokenData({
            tokenType:    1,
            team:         team,
            depositAmount: depositAmount,
            totalEarned:  totalEarned,
            round:        "",
            mintTime:     block.timestamp
        });
        emit ChampionNFTMinted(to, team, tokenId);
        return tokenId;
    }

    function mintEliminationBadge(
        address to,
        string memory team,
        uint256 depositAmount,
        string memory round
    ) external onlyVault returns (uint256) {
        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        tokenData[tokenId] = TokenData({
            tokenType:    0,
            team:         team,
            depositAmount: depositAmount,
            totalEarned:  0,
            round:        round,
            mintTime:     block.timestamp
        });
        emit EliminationBadgeMinted(to, team, tokenId);
        return tokenId;
    }

    // ─────────────────────────────── Metadata ───────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        TokenData memory data = tokenData[tokenId];

        string memory typeName     = data.tokenType == 1 ? "Champion" : "Elimination";
        string memory name         = data.tokenType == 1
            ? string.concat("STADIUM Champion - ", data.team)
            : string.concat("STADIUM Badge - ", data.team, " Eliminated");
        string memory description  = data.tokenType == 1
            ? string.concat("World Cup 2026 Champion Backer: ", data.team)
            : string.concat("Backed ", data.team, " in World Cup 2026. Eliminated - but you believed.");

        // Build attributes array
        string memory attrs = string.concat(
            '[',
            '{"trait_type":"Team","value":"', data.team, '"},',
            '{"trait_type":"Type","value":"', typeName, '"},',
            '{"trait_type":"Deposit USDC","value":"', _formatUSDC(data.depositAmount), '"},',
            '{"trait_type":"Mint Time","value":"', data.mintTime.toString(), '"}'
        );
        if (data.tokenType == 1 && data.totalEarned > 0) {
            attrs = string.concat(attrs, ',{"trait_type":"Total Earned USDC","value":"', _formatUSDC(data.totalEarned), '"}');
        }
        if (data.tokenType == 0 && bytes(data.round).length > 0) {
            attrs = string.concat(attrs, ',{"trait_type":"Round","value":"', data.round, '"}');
        }
        attrs = string.concat(attrs, ']');

        // Build image field
        string memory imageField = "";
        if (bytes(imageBaseURI).length > 0) {
            imageField = string.concat('"image":"', imageBaseURI, tokenId.toString(), '.png",');
        }

        string memory json = Base64.encode(
            bytes(
                string.concat(
                    '{"name":"', name, '",',
                    '"description":"', description, '",',
                    imageField,
                    '"attributes":', attrs,
                    '}'
                )
            )
        );

        return string.concat("data:application/json;base64,", json);
    }

    // ─────────────────────────────── View ───────────────────────────────

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ─────────────────────────────── Internal ───────────────────────────────

    function _formatUSDC(uint256 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e6;
        uint256 frac  = (amount % 1e6) / 1e4; // 2 decimal places
        if (frac == 0) return whole.toString();
        return string.concat(
            whole.toString(),
            ".",
            frac < 10 ? string.concat("0", frac.toString()) : frac.toString()
        );
    }
}
