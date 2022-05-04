//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./BetVault.sol";

contract BetVaultFactory {

    address immutable betVault;

    constructor(address _betVault) {
        betVault = _betVault;
    }

    function createVault(address _priceFeed, uint256 _biddingTimeEnd, uint256 _endTime) external returns (address) {
        address clone = Clones.clone(betVault);
        BetVault(clone).initialize(_priceFeed, _biddingTimeEnd, _endTime);
        return clone;
    }
}