// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GardenRegistry} from "../src/GardenRegistry.sol";
import {GardenTips} from "../src/GardenTips.sol";
import {MockMUSD} from "./mocks/MockMUSD.sol";

contract GardenTipsTest is Test {
    GardenRegistry registry;
    GardenTips tips;
    MockMUSD musd;

    address alice = makeAddr("alice"); // tipper
    address bob = makeAddr("bob"); // claimed recipient
    address carol = makeAddr("carol"); // never claimed

    event Tipped(address indexed from, address indexed to, uint256 amount, string memo);

    function setUp() public {
        registry = new GardenRegistry();
        musd = new MockMUSD();
        tips = new GardenTips(IERC20(address(musd)), registry);

        musd.mint(alice, 1_000 ether);
        vm.prank(alice);
        musd.approve(address(tips), type(uint256).max);

        vm.prank(bob);
        registry.claim("bob", "");
    }

    function test_constructor_setsImmutables() public view {
        assertEq(address(tips.token()), address(musd));
        assertEq(address(tips.registry()), address(registry));
    }

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(GardenTips.ZeroAddress.selector);
        new GardenTips(IERC20(address(0)), registry);
        vm.expectRevert(GardenTips.ZeroAddress.selector);
        new GardenTips(IERC20(address(musd)), GardenRegistry(address(0)));
    }

    function test_tip_movesFundsDirectlyAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit Tipped(alice, bob, 25 ether, "thanks for the tool");
        vm.prank(alice);
        tips.tip(bob, 25 ether, "thanks for the tool");

        assertEq(musd.balanceOf(alice), 975 ether);
        assertEq(musd.balanceOf(bob), 25 ether);
        assertEq(musd.balanceOf(address(tips)), 0, "contract must never hold funds");
    }

    function test_tip_allowsEmptyAndMaxMemo() public {
        vm.startPrank(alice);
        tips.tip(bob, 1 ether, "");
        tips.tip(bob, 1 ether, _memo(140));
        vm.stopPrank();
        assertEq(musd.balanceOf(bob), 2 ether);
    }

    function test_tip_revertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(GardenTips.ZeroAmount.selector);
        tips.tip(bob, 0, "");
    }

    function test_tip_revertsOnSelfTip() public {
        vm.prank(bob);
        vm.expectRevert(GardenTips.SelfTip.selector);
        tips.tip(bob, 1 ether, "");
    }

    function test_tip_revertsWhenRecipientNotClaimed() public {
        vm.prank(alice);
        vm.expectRevert(GardenTips.RecipientNotClaimed.selector);
        tips.tip(carol, 1 ether, "");
    }

    function test_tip_revertsWhenRecipientReleasedGarden() public {
        vm.prank(bob);
        registry.release();
        vm.prank(alice);
        vm.expectRevert(GardenTips.RecipientNotClaimed.selector);
        tips.tip(bob, 1 ether, "");
    }

    function test_tip_revertsOnLongMemo() public {
        vm.prank(alice);
        vm.expectRevert(GardenTips.MemoTooLong.selector);
        tips.tip(bob, 1 ether, _memo(141));
    }

    function test_tip_revertsWithoutAllowance() public {
        vm.prank(alice);
        musd.approve(address(tips), 0);
        vm.prank(alice);
        vm.expectRevert();
        tips.tip(bob, 1 ether, "");
    }

    function test_tip_revertsOnInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        tips.tip(bob, 1_001 ether, "");
    }

    function testFuzz_tip_conservesSupply(uint96 amount) public {
        amount = uint96(bound(amount, 1, 1_000 ether));
        uint256 supply = musd.totalSupply();
        vm.prank(alice);
        tips.tip(bob, amount, "fuzz");

        assertEq(musd.totalSupply(), supply);
        assertEq(musd.balanceOf(bob), amount);
        assertEq(musd.balanceOf(alice), 1_000 ether - amount);
        assertEq(musd.balanceOf(address(tips)), 0);
    }

    function _memo(uint256 len) internal pure returns (string memory) {
        bytes memory b = new bytes(len);
        for (uint256 i; i < len; ++i) {
            b[i] = "m";
        }
        return string(b);
    }
}

/// @dev Drives random tips across several actors for the invariant suite.
contract TipHandler is Test {
    GardenTips public tips;
    MockMUSD public musd;
    address[] public actors;

    constructor(GardenTips tips_, MockMUSD musd_, GardenRegistry registry_) {
        tips = tips_;
        musd = musd_;
        for (uint256 i; i < 4; ++i) {
            address a = address(uint160(0xA000 + i));
            actors.push(a);
            musd.mint(a, 1_000 ether);
            vm.prank(a);
            musd.approve(address(tips_), type(uint256).max);
            vm.prank(a);
            registry_.claim(string.concat("actor_", vm.toString(i)), "");
        }
    }

    function tip(uint256 fromSeed, uint256 toSeed, uint256 amount) external {
        address from = actors[fromSeed % actors.length];
        address to = actors[toSeed % actors.length];
        if (from == to) return;
        uint256 bal = musd.balanceOf(from);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        vm.prank(from);
        tips.tip(to, amount, "");
    }

    function totalHeldByActors() external view returns (uint256 total) {
        for (uint256 i; i < actors.length; ++i) {
            total += musd.balanceOf(actors[i]);
        }
    }
}

contract GardenTipsInvariantTest is StdInvariant, Test {
    GardenTips tips;
    MockMUSD musd;
    TipHandler handler;

    function setUp() public {
        GardenRegistry registry = new GardenRegistry();
        musd = new MockMUSD();
        tips = new GardenTips(IERC20(address(musd)), registry);
        handler = new TipHandler(tips, musd, registry);
        targetContract(address(handler));
    }

    function invariant_tipsContractNeverHoldsFunds() public view {
        assertEq(musd.balanceOf(address(tips)), 0);
    }

    function invariant_tippingOnlyRedistributes() public view {
        assertEq(handler.totalHeldByActors(), 4_000 ether);
    }
}
