//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// import "hardhat/console.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract BetVault {

    struct Bet {
        bool active;
        uint256 bidPrice;
        uint256 bidCollateral;
    }

    address public assetAddr;
    AggregatorV3Interface internal priceFeed;
    uint256 public biddingTimeEnd;
    uint256 public endTime;

    mapping(address => Bet) public bets;
    address[] public bidders;

    constructor(address _assetAddr, address _priceFeed, uint256 _biddingTimeEnd, uint256 _endTime) {
        require(_biddingTimeEnd <= _endTime, "Bidding time must be before whole bid ends");
        require(_biddingTimeEnd > block.timestamp, "Bidding must end after now");
        assetAddr = _assetAddr;
        biddingTimeEnd = _biddingTimeEnd;
        endTime = _endTime;
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function placeBid(uint256 _bidPrice) external payable {
        require(bets[msg.sender].active == false, "Already placed a bid");
        require(block.timestamp < biddingTimeEnd, "Too late to place a bid");
        bets[msg.sender] = Bet(true, _bidPrice, msg.value);
        bidders.push(msg.sender);
    }
}
