// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface IcUsdc {
    function mint(uint mintAmount) external returns (uint);
    function redeem(uint redeemTokens) external returns (uint);
    function balanceOf(address owner) external view returns (uint256);
}