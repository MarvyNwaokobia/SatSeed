// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {GardenRegistry} from "./GardenRegistry.sol";

/// @title GardenTips
/// @notice Pass-through MUSD tips to claimed gardens. Never custodial: funds move from tipper to
///         recipient in one transfer, and the contract keeps no balance and takes no fee.
/// @dev The event gives the indexer a clean, attributable record (with an optional memo) that a
///      bare ERC-20 transfer would not. The tipper must approve this contract first.
contract GardenTips {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_MEMO_LENGTH = 140;

    IERC20 public immutable token;
    GardenRegistry public immutable registry;

    event Tipped(address indexed from, address indexed to, uint256 amount, string memo);

    error ZeroAmount();
    error SelfTip();
    error RecipientNotClaimed();
    error MemoTooLong();
    error ZeroAddress();

    constructor(IERC20 token_, GardenRegistry registry_) {
        if (address(token_) == address(0) || address(registry_) == address(0)) revert ZeroAddress();
        token = token_;
        registry = registry_;
    }

    /// @notice Tip `amount` of the token to a claimed garden owner.
    function tip(address to, uint256 amount, string calldata memo) external {
        if (amount == 0) revert ZeroAmount();
        if (to == msg.sender) revert SelfTip();
        if (!registry.isClaimed(to)) revert RecipientNotClaimed();
        if (bytes(memo).length > MAX_MEMO_LENGTH) revert MemoTooLong();

        token.safeTransferFrom(msg.sender, to, amount);

        emit Tipped(msg.sender, to, amount, memo);
    }
}
