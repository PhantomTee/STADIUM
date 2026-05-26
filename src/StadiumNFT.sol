// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Mints EliminationBadge (type 0) and ChampionNFT (type 1) with on-chain SVG metadata
contract StadiumNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 private _tokenIdCounter;
    address public convictionHook;

    struct TokenData {
        uint8 tokenType;       // 0 = EliminationBadge, 1 = ChampionNFT
        string team;
        uint256 depositAmount;
        uint256 totalEarned;   // for champion NFT
        string round;          // for elimination badge
        uint256 mintTime;
    }

    mapping(uint256 => TokenData) public tokenData;

    event EliminationBadgeMinted(address indexed to, string team, uint256 tokenId);
    event ChampionNFTMinted(address indexed to, string team, uint256 tokenId);

    modifier onlyHook() {
        require(msg.sender == convictionHook, "StadiumNFT: not hook");
        _;
    }

    constructor(address initialOwner) ERC721("STADIUM NFT", "STDM") Ownable(initialOwner) {}

    function setConvictionHook(address _hook) external onlyOwner {
        convictionHook = _hook;
    }

    function mintChampionNFT(
        address to,
        string memory team,
        uint256 depositAmount,
        uint256 totalEarned
    ) external onlyHook returns (uint256) {
        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        tokenData[tokenId] = TokenData({
            tokenType: 1,
            team: team,
            depositAmount: depositAmount,
            totalEarned: totalEarned,
            round: "",
            mintTime: block.timestamp
        });
        emit ChampionNFTMinted(to, team, tokenId);
        return tokenId;
    }

    function mintEliminationBadge(
        address to,
        string memory team,
        uint256 depositAmount,
        string memory round
    ) external onlyHook returns (uint256) {
        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        tokenData[tokenId] = TokenData({
            tokenType: 0,
            team: team,
            depositAmount: depositAmount,
            totalEarned: 0,
            round: round,
            mintTime: block.timestamp
        });
        emit EliminationBadgeMinted(to, team, tokenId);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        TokenData memory data = tokenData[tokenId];

        string memory svg;
        string memory name;
        string memory description;

        if (data.tokenType == 1) {
            (svg, name, description) = _buildChampionSVG(data);
        } else {
            (svg, name, description) = _buildEliminationSVG(data);
        }

        string memory json = Base64.encode(
            bytes(
                string.concat(
                    '{"name":"', name, '",',
                    '"description":"', description, '",',
                    '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
                    '"attributes":[',
                    '{"trait_type":"Team","value":"', data.team, '"},',
                    '{"trait_type":"Type","value":"', data.tokenType == 1 ? "Champion" : "Elimination", '"},',
                    '{"trait_type":"Deposit","value":"', _formatUSDC(data.depositAmount), '"}',
                    ']}'
                )
            )
        );

        return string.concat("data:application/json;base64,", json);
    }

    function _buildChampionSVG(TokenData memory data)
        internal
        pure
        returns (string memory svg, string memory name, string memory description)
    {
        name = string.concat("STADIUM Champion — ", data.team);
        description = string.concat("World Cup 2026 Champion Backer: ", data.team);

        svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#1a1a2e"/>',
            '<stop offset="100%" style="stop-color:#16213e"/>',
            '</linearGradient></defs>',
            '<rect width="400" height="400" fill="url(#bg)" rx="20"/>',
            '<rect x="10" y="10" width="380" height="380" fill="none" stroke="#FFD700" stroke-width="3" rx="16"/>',
            // Trophy icon
            '<path d="M160 80 L240 80 L240 140 Q240 170 200 180 Q160 170 160 140 Z" fill="#FFD700"/>',
            '<path d="M160 100 L130 100 Q120 100 120 120 Q120 150 160 155" fill="none" stroke="#FFD700" stroke-width="4"/>',
            '<path d="M240 100 L270 100 Q280 100 280 120 Q280 150 240 155" fill="none" stroke="#FFD700" stroke-width="4"/>',
            '<rect x="190" y="180" width="20" height="30" fill="#FFD700"/>',
            '<rect x="160" y="210" width="80" height="15" fill="#FFD700" rx="4"/>',
            // Text
            '<text x="200" y="270" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#FFD700" text-anchor="middle">',
            data.team,
            '</text>',
            '<text x="200" y="300" font-family="Arial,sans-serif" font-size="12" fill="#FFF" text-anchor="middle">',
            'STADIUM World Cup 2026 Champion Backer',
            '</text>',
            '<text x="200" y="325" font-family="Arial,sans-serif" font-size="11" fill="#FFD700" text-anchor="middle">',
            'Deposited: $', _formatUSDC(data.depositAmount),
            '</text>',
            '<text x="200" y="345" font-family="Arial,sans-serif" font-size="11" fill="#FFD700" text-anchor="middle">',
            'Earned: $', _formatUSDC(data.totalEarned),
            '</text>',
            '<text x="200" y="375" font-family="Arial,sans-serif" font-size="10" fill="#888" text-anchor="middle">',
            'STADIUM Protocol',
            '</text>',
            '</svg>'
        );
    }

    function _buildEliminationSVG(TokenData memory data)
        internal
        pure
        returns (string memory svg, string memory name, string memory description)
    {
        name = string.concat("STADIUM Badge — ", data.team, " Eliminated");
        description = string.concat("Backed ", data.team, " in World Cup 2026. Eliminated — but you believed.");

        svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<defs><linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">',
            '<stop offset="0%" style="stop-color:#1c1c1c"/>',
            '<stop offset="100%" style="stop-color:#2a2a2a"/>',
            '</linearGradient></defs>',
            '<rect width="400" height="400" fill="url(#bg2)" rx="20"/>',
            '<rect x="10" y="10" width="380" height="380" fill="none" stroke="#666" stroke-width="2" rx="16"/>',
            // Shield icon
            '<path d="M200 80 L240 100 L240 160 Q240 190 200 200 Q160 190 160 160 L160 100 Z" fill="none" stroke="#888" stroke-width="3"/>',
            '<text x="200" y="160" font-family="Arial,sans-serif" font-size="36" fill="#888" text-anchor="middle">&#10007;</text>',
            // Text
            '<text x="200" y="240" font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#aaa" text-anchor="middle">',
            data.team,
            '</text>',
            '<text x="200" y="270" font-family="Arial,sans-serif" font-size="12" fill="#777" text-anchor="middle">',
            'Eliminated — but you believed.',
            '</text>',
            '<text x="200" y="300" font-family="Arial,sans-serif" font-size="11" fill="#666" text-anchor="middle">',
            'Deposited: $', _formatUSDC(data.depositAmount),
            '</text>',
            '<text x="200" y="322" font-family="Arial,sans-serif" font-size="11" fill="#666" text-anchor="middle">',
            'Recovered: $', _formatUSDC(data.depositAmount / 2),
            '</text>',
            '<text x="200" y="345" font-family="Arial,sans-serif" font-size="11" fill="#555" text-anchor="middle">',
            'Round: ', data.round,
            '</text>',
            '<text x="200" y="375" font-family="Arial,sans-serif" font-size="10" fill="#444" text-anchor="middle">',
            'STADIUM Protocol',
            '</text>',
            '</svg>'
        );
    }

    function _formatUSDC(uint256 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e6;
        uint256 frac = (amount % 1e6) / 1e4; // 2 decimal places
        if (frac == 0) return whole.toString();
        return string.concat(whole.toString(), ".", frac < 10 ? string.concat("0", frac.toString()) : frac.toString());
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
