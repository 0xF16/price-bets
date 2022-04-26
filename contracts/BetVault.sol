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
    enum Status {WIP, AWAITING_WITHDRAWAL, CLOSED}
    uint256 MAX_UINT = 2**256 - 1;

    AggregatorV3Interface internal priceFeed;
    uint256 public biddingTimeEnd;
    uint256 public endTime;

    mapping(address => Bet) public bets;
    address[] public bidders;
    Status private status;
    uint256 public priceFromOracle;
    address[] public winners;

    constructor(address _priceFeed, uint256 _biddingTimeEnd, uint256 _endTime) {
        require(_biddingTimeEnd <= _endTime, "Bidding time must be before whole bid ends");
        require(_biddingTimeEnd > block.timestamp, "Bidding must end after now");
        biddingTimeEnd = _biddingTimeEnd;
        endTime = _endTime;
        priceFeed = AggregatorV3Interface(_priceFeed);
        status = Status.WIP;
    }

    function placeBid(uint256 _bidPrice) external payable {
        require(bets[msg.sender].active == false, "Already placed a bid");
        require(block.timestamp < biddingTimeEnd, "Too late to place a bid");
        bets[msg.sender] = Bet(true, _bidPrice, msg.value);
        bidders.push(msg.sender);
    }

    function assesPrice() external {
        require(status == Status.WIP, "Price already fetched");
        require(block.timestamp > endTime, "It's not yet time to check prices");
        (uint256 _priceFromOracle, uint8 decimals) = getLatestPrice();
        priceFromOracle = _priceFromOracle/uint256(10**decimals);
        status = Status.AWAITING_WITHDRAWAL;
    }

    function checkWhoWon() external {
        require(status == Status.AWAITING_WITHDRAWAL, "Assess the price of an asset first");
        uint256 bestDiff = MAX_UINT;
        uint256 bestBid;
        uint256 n_best_bids;

        for(uint256 i; i < bidders.length; i++) {
            uint256 _diff;
            uint256 bid = bets[bidders[i]].bidPrice;
            if (bid > priceFromOracle) {
                _diff = bid - priceFromOracle;
            } else if (bid <= priceFromOracle) {
                _diff = priceFromOracle - bid;
            }

            if(_diff < bestDiff) {
                bestBid = bid;
                bestDiff = _diff;
                n_best_bids = 1;
            } else if(_diff == bestDiff) {
                n_best_bids++;
            }
        }

        address[] memory bestBidders = new address[](n_best_bids);
        uint256 j;
        for(uint256 i; i < bidders.length; i++) {
            uint256 bid = bets[bidders[i]].bidPrice;
            if(bid == bestBid) {
                bestBidders[j] = bidders[i];
                j++;
            }
        }
        winners = bestBidders;
    }

    function withdrawal() external {
        uint256 reward = address(this).balance/winners.length;
        for(uint256 i; i < winners.length; i++) {
            (bool success, ) = winners[i].call{value: reward}("");
            require(success, "Failed to send reward to one of the addresses");
        }
        status = Status.CLOSED;
    }

    function close() external {
        if(status == Status.WIP) this.assesPrice();
        this.checkWhoWon();
        this.withdrawal();
    }

    function winnersCount() external view returns (uint256) {
        return winners.length;
    }

    function getLatestPrice() internal view returns (uint256, uint8) {
        (
            /*uint80 roundID*/,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();
        uint8 decimals = priceFeed.decimals();
        if(price < 0) return (uint(-price), decimals);
        return (uint(price), decimals);
    }
}
