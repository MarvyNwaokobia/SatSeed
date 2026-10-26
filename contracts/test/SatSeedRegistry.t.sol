// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SatSeedRegistry} from "../src/SatSeedRegistry.sol";

/// @dev Minimal ERC-1271 wallet that accepts signatures from a single signer.
contract Wallet1271 {
    address public immutable signer;

    constructor(address signer_) {
        signer = signer_;
    }

    function isValidSignature(bytes32 hash, bytes calldata sig) external view returns (bytes4) {
        if (sig.length != 65) return 0xffffffff;
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        return ecrecover(hash, v, r, s) == signer ? bytes4(0x1626ba7e) : bytes4(0xffffffff);
    }
}

contract SatSeedRegistryTest is Test {
    SatSeedRegistry registry;

    uint256 aliceKey = 0xA11CE;
    address alice;
    address bob = makeAddr("bob");
    address relayer = makeAddr("relayer");

    event GardenClaimed(address indexed owner, string handle, string metadataURI);
    event GardenUpdated(address indexed owner, string handle, string metadataURI);
    event GardenReleased(address indexed owner, string handle);
    event SignaturesCancelled(address indexed owner, uint256 newNonce);

    function setUp() public {
        registry = new SatSeedRegistry();
        alice = vm.addr(aliceKey);
    }

    // ---------------------------------------------------------------- helpers

    function _sign(
        uint256 key,
        address owner,
        string memory handle,
        string memory uri,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                registry.CLAIM_TYPEHASH(), owner, keccak256(bytes(handle)), keccak256(bytes(uri)), nonce, deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", registry.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    // ------------------------------------------------------------------ claim

    function test_claim_storesGardenAndEmits() public {
        vm.warp(1_000);
        vm.expectEmit(true, false, false, true);
        emit GardenClaimed(alice, "alice", "ipfs://x");
        vm.prank(alice);
        registry.claim("alice", "ipfs://x");

        SatSeedRegistry.Garden memory g = registry.gardenOf(alice);
        assertEq(g.handle, "alice");
        assertEq(g.metadataURI, "ipfs://x");
        assertEq(g.claimedAt, 1_000);
        assertTrue(registry.isClaimed(alice));
        assertEq(registry.ownerOfHandle("alice"), alice);
    }

    function test_claim_revertsWhenAlreadyClaimed() public {
        vm.startPrank(alice);
        registry.claim("alice", "");
        vm.expectRevert(SatSeedRegistry.AlreadyClaimed.selector);
        registry.claim("alice2", "");
        vm.stopPrank();
    }

    function test_claim_revertsWhenHandleTaken() public {
        vm.prank(alice);
        registry.claim("sprout", "");
        vm.prank(bob);
        vm.expectRevert(SatSeedRegistry.HandleTaken.selector);
        registry.claim("sprout", "");
    }

    function test_claim_revertsOnLongURI() public {
        bytes memory long = new bytes(257);
        for (uint256 i; i < long.length; ++i) {
            long[i] = "a";
        }
        vm.prank(alice);
        vm.expectRevert(SatSeedRegistry.MetadataURITooLong.selector);
        registry.claim("alice", string(long));
    }

    function test_claim_acceptsMaxLengthURI() public {
        bytes memory max = new bytes(256);
        for (uint256 i; i < max.length; ++i) {
            max[i] = "a";
        }
        vm.prank(alice);
        registry.claim("alice", string(max));
        assertTrue(registry.isClaimed(alice));
    }

    // --------------------------------------------------------------- handles

    function test_handle_validAndInvalid() public view {
        assertTrue(registry.isHandleAvailable("abc"));
        assertTrue(registry.isHandleAvailable("a_b_c"));
        assertTrue(registry.isHandleAvailable("abcdefghijklmnopqrstuvwxyz012345")); // 32 chars

        assertFalse(registry.isHandleAvailable("ab")); // too short
        assertFalse(registry.isHandleAvailable("abcdefghijklmnopqrstuvwxyz0123456")); // 33 chars
        assertFalse(registry.isHandleAvailable("Alice")); // uppercase
        assertFalse(registry.isHandleAvailable("a b")); // space
        assertFalse(registry.isHandleAvailable("_abc")); // leading underscore
        assertFalse(registry.isHandleAvailable("abc_")); // trailing underscore
        assertFalse(registry.isHandleAvailable("a-b")); // hyphen
        assertFalse(registry.isHandleAvailable("")); // empty
    }

    function test_claim_revertsOnInvalidHandle() public {
        vm.prank(alice);
        vm.expectRevert(SatSeedRegistry.InvalidHandle.selector);
        registry.claim("Bad Handle", "");
    }

    function test_handleAvailability_falseOnceTaken() public {
        vm.prank(alice);
        registry.claim("taken", "");
        assertFalse(registry.isHandleAvailable("taken"));
    }

    function testFuzz_handle_neverAcceptsOutsideCharset(bytes memory raw) public view {
        bool hasBadChar;
        for (uint256 i; i < raw.length; ++i) {
            bytes1 c = raw[i];
            if (!((c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "_")) hasBadChar = true;
        }
        if (hasBadChar) assertFalse(registry.isHandleAvailable(string(raw)));
    }

    // -------------------------------------------------------------- signature

    function test_claimWithSignature_relayedByAnyone() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, "alice", "uri", 0, deadline);

        vm.prank(relayer);
        registry.claimWithSignature(alice, "alice", "uri", deadline, sig);

        assertTrue(registry.isClaimed(alice));
        assertEq(registry.ownerOfHandle("alice"), alice);
        assertFalse(registry.isClaimed(relayer));
        assertEq(registry.nonceOf(alice), 1);
    }

    function test_claimWithSignature_revertsWhenExpired() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, "alice", "", 0, deadline);
        vm.warp(deadline + 1);
        vm.expectRevert(SatSeedRegistry.SignatureExpired.selector);
        registry.claimWithSignature(alice, "alice", "", deadline, sig);
    }

    function test_claimWithSignature_acceptsAtDeadline() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, "alice", "", 0, deadline);
        vm.warp(deadline);
        registry.claimWithSignature(alice, "alice", "", deadline, sig);
        assertTrue(registry.isClaimed(alice));
    }

    function test_claimWithSignature_revertsOnWrongSigner() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(0xB0B, alice, "alice", "", 0, deadline);
        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(alice, "alice", "", deadline, sig);
    }

    function test_claimWithSignature_revertsWhenFieldsTampered() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, "alice", "uri", 0, deadline);

        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(alice, "mallory", "uri", deadline, sig);

        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(alice, "alice", "other", deadline, sig);
    }

    function test_claimWithSignature_cannotReplay() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, "alice", "", 0, deadline);
        registry.claimWithSignature(alice, "alice", "", deadline, sig);

        // After releasing, the same signature must not work again (nonce consumed).
        vm.prank(alice);
        registry.release();
        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(alice, "alice", "", deadline, sig);
    }

    function test_claimWithSignature_failedClaimDoesNotBurnNonce() public {
        // A revert rolls back the nonce too, so a signature that hits a taken handle stays usable.
        vm.prank(bob);
        registry.claim("alice", "");

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, alice, "alice", "", 0, deadline);
        vm.expectRevert(SatSeedRegistry.HandleTaken.selector);
        registry.claimWithSignature(alice, "alice", "", deadline, sig);
        assertEq(registry.nonceOf(alice), 0);
    }

    function test_claimWithSignature_supportsERC1271Wallet() public {
        Wallet1271 wallet = new Wallet1271(alice);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(aliceKey, address(wallet), "vault", "", 0, deadline);

        registry.claimWithSignature(address(wallet), "vault", "", deadline, sig);
        assertTrue(registry.isClaimed(address(wallet)));
    }

    // ---------------------------------------------------------------- update

    function test_update_changesHandleAndFreesOld() public {
        vm.startPrank(alice);
        registry.claim("old_name", "a");
        vm.expectEmit(true, false, false, true);
        emit GardenUpdated(alice, "new_name", "b");
        registry.update("new_name", "b");
        vm.stopPrank();

        assertEq(registry.ownerOfHandle("old_name"), address(0));
        assertEq(registry.ownerOfHandle("new_name"), alice);
        assertEq(registry.gardenOf(alice).metadataURI, "b");
        assertTrue(registry.isHandleCoolingDown("old_name"));
    }

    function test_update_sameHandleOnlyChangesMetadata() public {
        vm.startPrank(alice);
        registry.claim("alice", "a");
        registry.update("alice", "b");
        vm.stopPrank();

        assertEq(registry.gardenOf(alice).handle, "alice");
        assertEq(registry.gardenOf(alice).metadataURI, "b");
        assertEq(registry.ownerOfHandle("alice"), alice);
    }

    function test_update_revertsWhenNotClaimed() public {
        vm.prank(alice);
        vm.expectRevert(SatSeedRegistry.NotClaimed.selector);
        registry.update("alice", "");
    }

    function test_update_revertsWhenNewHandleTaken() public {
        vm.prank(bob);
        registry.claim("bobby", "");
        vm.startPrank(alice);
        registry.claim("alice", "");
        vm.expectRevert(SatSeedRegistry.HandleTaken.selector);
        registry.update("bobby", "");
        vm.stopPrank();
    }

    function test_update_revertsOnInvalidNewHandle() public {
        vm.startPrank(alice);
        registry.claim("alice", "");
        vm.expectRevert(SatSeedRegistry.InvalidHandle.selector);
        registry.update("NOPE", "");
        vm.stopPrank();
    }

    function test_update_preservesClaimedAt() public {
        vm.warp(500);
        vm.startPrank(alice);
        registry.claim("alice", "");
        vm.warp(9_000);
        registry.update("alice2", "");
        vm.stopPrank();
        assertEq(registry.gardenOf(alice).claimedAt, 500);
    }

    // -------------------------------------------------------- handle cooldown

    function test_release_reservesHandleForPreviousOwner() public {
        vm.prank(alice);
        registry.claim("alice", "");
        vm.prank(alice);
        registry.release();

        assertTrue(registry.isHandleCoolingDown("alice"));
        assertFalse(registry.isHandleAvailable("alice"));

        vm.prank(bob);
        vm.expectRevert(SatSeedRegistry.HandleCoolingDown.selector);
        registry.claim("alice", "");
    }

    function test_cooldown_previousOwnerCanReclaim() public {
        vm.startPrank(alice);
        registry.claim("alice", "");
        registry.release();
        registry.claim("alice", "");
        vm.stopPrank();
        assertEq(registry.ownerOfHandle("alice"), alice);
    }

    function test_cooldown_endsAfterThirtyDays() public {
        vm.prank(alice);
        registry.claim("alice", "");
        vm.prank(alice);
        registry.release();

        vm.warp(block.timestamp + registry.HANDLE_COOLDOWN() - 1);
        vm.prank(bob);
        vm.expectRevert(SatSeedRegistry.HandleCoolingDown.selector);
        registry.claim("alice", "");

        vm.warp(block.timestamp + 1);
        assertTrue(registry.isHandleAvailable("alice"));
        vm.prank(bob);
        registry.claim("alice", "");
        assertEq(registry.ownerOfHandle("alice"), bob);
    }

    function test_cooldown_appliesWhenChangingHandle() public {
        vm.prank(alice);
        registry.claim("old_name", "");
        vm.prank(alice);
        registry.update("new_name", "");

        vm.prank(bob);
        vm.expectRevert(SatSeedRegistry.HandleCoolingDown.selector);
        registry.claim("old_name", "");
    }

    function test_cooldown_appliesToUpdateIntoCoolingHandle() public {
        vm.prank(alice);
        registry.claim("alice", "");
        vm.prank(alice);
        registry.release();

        vm.startPrank(bob);
        registry.claim("bobby", "");
        vm.expectRevert(SatSeedRegistry.HandleCoolingDown.selector);
        registry.update("alice", "");
        vm.stopPrank();
    }

    function test_cooldown_doesNotAffectNeverUsedHandles() public view {
        assertFalse(registry.isHandleCoolingDown("fresh_name"));
        assertTrue(registry.isHandleAvailable("fresh_name"));
    }

    // ------------------------------------------------------- cancel signatures

    function test_cancelSignatures_invalidatesOutstandingSignature() public {
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _sign(aliceKey, alice, "alice", "", 0, deadline);

        vm.expectEmit(true, false, false, true);
        emit SignaturesCancelled(alice, 1);
        vm.prank(alice);
        registry.cancelSignatures();
        assertEq(registry.nonceOf(alice), 1);

        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(alice, "alice", "", deadline, sig);
    }

    // ------------------------------------------------------ malformed signatures

    function test_claimWithSignature_revertsOnGarbageSignature() public {
        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(alice, "alice", "", block.timestamp + 1, hex"deadbeef");
    }

    function test_claimWithSignature_revertsOnEmptySignature() public {
        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(alice, "alice", "", block.timestamp + 1, "");
    }

    function test_claimWithSignature_revertsForZeroAddressOwner() public {
        // An invalid signature recovers to address(0); it must not authorise claiming for it.
        bytes memory sig = new bytes(65);
        vm.expectRevert(SatSeedRegistry.InvalidSignature.selector);
        registry.claimWithSignature(address(0), "zero", "", block.timestamp + 1, sig);
    }

    // --------------------------------------------------------------- release

    function test_release_deletesRecordAndFreesHandle() public {
        vm.startPrank(alice);
        registry.claim("alice", "uri");
        vm.expectEmit(true, false, false, true);
        emit GardenReleased(alice, "alice");
        registry.release();
        vm.stopPrank();

        assertFalse(registry.isClaimed(alice));
        assertEq(registry.gardenOf(alice).claimedAt, 0);
        assertEq(bytes(registry.gardenOf(alice).handle).length, 0);
        assertEq(registry.ownerOfHandle("alice"), address(0));

        // alice can claim again; bob can't take the handle during the cooldown
        vm.prank(alice);
        registry.claim("alice_again", "");
        vm.prank(bob);
        vm.expectRevert(SatSeedRegistry.HandleCoolingDown.selector);
        registry.claim("alice", "");
    }

    function test_release_revertsWhenNotClaimed() public {
        vm.prank(alice);
        vm.expectRevert(SatSeedRegistry.NotClaimed.selector);
        registry.release();
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_handleOwnershipStaysConsistent(uint8 n) public {
        n = uint8(bound(n, 1, 20));
        for (uint256 i; i < n; ++i) {
            address user = address(uint160(0x1000 + i));
            string memory handle = string.concat("user_", vm.toString(i));
            vm.prank(user);
            registry.claim(handle, "");
            assertEq(registry.ownerOfHandle(handle), user);
            assertEq(registry.gardenOf(user).handle, handle);
        }
    }
}
