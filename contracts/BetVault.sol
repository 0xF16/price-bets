//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract BetVault {

    struct Bet {
        bool active;
        uint256 bidPrice;
        uint256 bidCollateral;
    }
    address private factory;
    uint256 private MAX_UINT = 2**256 - 1;

    AggregatorV3Interface internal priceFeed;
    uint256 public biddingTimeEnd;
    uint256 public endTime;

    mapping(address => Bet) public bets;
    address[] public bidders;

    event Winner(address, uint256);

    constructor() {
        factory = address(0xdead); //flag to ensure we cannot do anything on the factory smart-contract
    }

    function initialize(address _priceFeed, uint256 _biddingTimeEnd, uint256 _endTime) external {
        require(factory == address(0), "FORBIDDEN");
        require(_biddingTimeEnd <= _endTime, "Bidding time must be before whole bid ends");
        require(_biddingTimeEnd > block.timestamp, "Bidding must end after now");
        biddingTimeEnd = _biddingTimeEnd;
        endTime = _endTime;
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function placeBid(uint256 _bidPrice) external payable {
        require(bets[msg.sender].active == false, "Address already placed a bid");
        require(block.timestamp < biddingTimeEnd, "Too late to place a bid");
        bets[msg.sender] = Bet(true, _bidPrice, msg.value);
        bidders.push(msg.sender);
    }

    function getAssetPrice() internal view returns (uint256) {
        (uint256 _priceFromOracle, uint8 decimals) = getLatestPrice();
        return _priceFromOracle/uint256(10**decimals);
    }

    function checkWhoWon(uint256 _assetPrice) internal view returns (address[] memory) {
        uint256 bestDiff = MAX_UINT;
        uint256 bestBid;
        uint256 n_best_bids;

        for(uint256 i; i < bidders.length; i++) {
            uint256 _diff;
            uint256 bid = bets[bidders[i]].bidPrice;
            if (bid > _assetPrice) {
                _diff = bid - _assetPrice;
            } else if (bid <= _assetPrice) {
                _diff = _assetPrice - bid;
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
        return bestBidders;
    }

    function withdraw(address[] memory _winners) internal returns (uint256) {
        uint256 reward = address(this).balance/_winners.length;
        for(uint256 i; i < _winners.length; i++) {
            (bool success, ) = _winners[i].call{value: reward}("");
            require(success, "Failed to send reward to one of the addresses");
        }
        return _winners.length;
    }

    function close() external returns (uint256) {
        require(endTime < block.timestamp, "It is not yet time to validate results" );
        uint256 assetPrice = getAssetPrice();
        address[] memory winners = checkWhoWon(assetPrice);
        return withdraw(winners);
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
