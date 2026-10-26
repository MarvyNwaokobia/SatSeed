// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title GardenRegistry
/// @notice Opt-in registry where a wallet claims its public garden under a unique handle.
/// @dev Holds no funds. A claim can be sent by the wallet itself or relayed by anyone with the
///      wallet's EIP-712 signature (so claiming can be free for the user). ERC-1271 wallets work.
///      Scores live off-chain; this contract only records who opted in and under which name.
contract GardenRegistry is EIP712, Nonces {
    uint256 public constant MIN_HANDLE_LENGTH = 3;
    uint256 public constant MAX_HANDLE_LENGTH = 32;
    uint256 public constant MAX_URI_LENGTH = 256;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address owner,string handle,string metadataURI,uint256 nonce,uint256 deadline)");

    struct Garden {
        string handle;
        string metadataURI;
        uint64 claimedAt;
    }

    mapping(address owner => Garden) private _gardens;
    mapping(bytes32 handleHash => address owner) private _handleOwner;

    event GardenClaimed(address indexed owner, string handle, string metadataURI);
    event GardenUpdated(address indexed owner, string handle, string metadataURI);
    event GardenReleased(address indexed owner, string handle);

    error AlreadyClaimed();
    error NotClaimed();
    error HandleTaken();
    error InvalidHandle();
    error MetadataURITooLong();
    error SignatureExpired();
    error InvalidSignature();

    constructor() EIP712("GardenRegistry", "1") {}

    // ------------------------------------------------------------------ claim

    /// @notice Claim a garden for the caller.
    function claim(string calldata handle, string calldata metadataURI) external {
        _claim(msg.sender, handle, metadataURI);
    }

    /// @notice Claim a garden for `owner` using their signature. Anyone may relay it.
    function claimWithSignature(
        address owner,
        string calldata handle,
        string calldata metadataURI,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (block.timestamp > deadline) revert SignatureExpired();

        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                owner,
                keccak256(bytes(handle)),
                keccak256(bytes(metadataURI)),
                _useNonce(owner),
                deadline
            )
        );
        if (!SignatureChecker.isValidSignatureNow(owner, _hashTypedDataV4(structHash), signature)) {
            revert InvalidSignature();
        }

        _claim(owner, handle, metadataURI);
    }

    // ----------------------------------------------------------------- update

    /// @notice Change handle and/or metadata. The old handle is freed.
    function update(string calldata handle, string calldata metadataURI) external {
        Garden storage g = _gardens[msg.sender];
        if (g.claimedAt == 0) revert NotClaimed();
        _checkURI(metadataURI);

        bytes32 oldHash = keccak256(bytes(g.handle));
        bytes32 newHash = keccak256(bytes(handle));
        if (newHash != oldHash) {
            _checkHandle(handle);
            if (_handleOwner[newHash] != address(0)) revert HandleTaken();
            delete _handleOwner[oldHash];
            _handleOwner[newHash] = msg.sender;
            g.handle = handle;
        }
        g.metadataURI = metadataURI;

        emit GardenUpdated(msg.sender, handle, metadataURI);
    }

    /// @notice Delete the caller's garden record and free the handle.
    function release() external {
        Garden memory g = _gardens[msg.sender];
        if (g.claimedAt == 0) revert NotClaimed();

        delete _handleOwner[keccak256(bytes(g.handle))];
        delete _gardens[msg.sender];

        emit GardenReleased(msg.sender, g.handle);
    }

    // ------------------------------------------------------------------- views

    function isClaimed(address owner) external view returns (bool) {
        return _gardens[owner].claimedAt != 0;
    }

    function gardenOf(address owner) external view returns (Garden memory) {
        return _gardens[owner];
    }

    function ownerOfHandle(string calldata handle) external view returns (address) {
        return _handleOwner[keccak256(bytes(handle))];
    }

    function isHandleAvailable(string calldata handle) external view returns (bool) {
        return _isValidHandle(bytes(handle)) && _handleOwner[keccak256(bytes(handle))] == address(0);
    }

    function nonceOf(address owner) external view returns (uint256) {
        return nonces(owner);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------- internal

    function _claim(address owner, string calldata handle, string calldata metadataURI) private {
        if (_gardens[owner].claimedAt != 0) revert AlreadyClaimed();
        _checkHandle(handle);
        _checkURI(metadataURI);

        bytes32 h = keccak256(bytes(handle));
        if (_handleOwner[h] != address(0)) revert HandleTaken();

        _handleOwner[h] = owner;
        _gardens[owner] = Garden({handle: handle, metadataURI: metadataURI, claimedAt: uint64(block.timestamp)});

        emit GardenClaimed(owner, handle, metadataURI);
    }

    function _checkHandle(string calldata handle) private pure {
        if (!_isValidHandle(bytes(handle))) revert InvalidHandle();
    }

    function _checkURI(string calldata uri) private pure {
        if (bytes(uri).length > MAX_URI_LENGTH) revert MetadataURITooLong();
    }

    /// @dev 3-32 chars of [a-z0-9_], not starting or ending with '_'.
    function _isValidHandle(bytes memory b) private pure returns (bool) {
        uint256 len = b.length;
        if (len < MIN_HANDLE_LENGTH || len > MAX_HANDLE_LENGTH) return false;
        if (b[0] == "_" || b[len - 1] == "_") return false;
        for (uint256 i; i < len; ++i) {
            bytes1 c = b[i];
            bool ok = (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "_";
            if (!ok) return false;
        }
        return true;
    }
}
