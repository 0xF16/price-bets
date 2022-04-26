const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("hardhat").ethers.utils;

const priceOracle = "0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8"; //Arbitrum Rinkeby ETH/USD price https://docs.chain.link/docs/arbitrum-price-feeds/

describe("BetVault contract deployment", () => {
  let BetVault;
  let deployer;

  before(async () => {
    [deployer] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
  });
  it("Cannot deploy a vault with bidding that ends before whole session end", async function () {

    await expect(BetVault.deploy(priceOracle, 1650884797, 1650884796)).to.be.revertedWith("Bidding time must be before whole bid ends");
  });

  it("Cannot deploy a vault with time that already passed", async function () {
    let lastBlockTime = await ethers.provider.getBlock("latest");
    lastBlockTime = lastBlockTime.timestamp;

    await expect(BetVault.deploy(priceOracle, lastBlockTime-10, lastBlockTime+10)).to.be.revertedWith("Bidding must end after now");
  });
});

describe("BetVault placing bids", () => {
  let BetVault;
  let betVault;
  let deployer, address1, address2;

  before(async () => {
    [deployer, address1, address2] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
    let lastBlockTime = await ethers.provider.getBlock("latest");
    lastBlockTime = lastBlockTime.timestamp;
    betVault = await BetVault.deploy(priceOracle, lastBlockTime+10, lastBlockTime+20);
  });
  it("Can place bids", async function () {
    await betVault.connect(address1).placeBid(3000, {value: ethers.utils.parseEther('1')});
    const bet = await betVault.bets(address1.address);

    expect(bet.active).to.equal(true);
  });
  it("Cannot place new bets when there is a bet for that user already", async function () {

    await expect(betVault.connect(address1).placeBid(3000, {value: ethers.utils.parseEther('1')})).to.be.revertedWith("Already placed a bid");
  });
  it("Another user can place a new bid", async function () {
    await betVault.connect(address2).placeBid(3000, {value: ethers.utils.parseEther('0.5')});

    expect(await ethers.provider.getBalance(betVault.address)).to.equal(ethers.utils.parseUnits('1.5', 'ether'));
  });
});

describe("BetVault closing bets", () => {
  let BetVault;
  let betVault;
  let deployer, address1, address2;

  beforeEach(async () => {
    [deployer, address1, address2, address3] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
    let lastBlockTime = await ethers.provider.getBlock("latest");
    lastBlockTime = lastBlockTime.timestamp;
    betVault = await BetVault.deploy(priceOracle, lastBlockTime+10, lastBlockTime+11);
  });
  it("Cannot assess price before bidding period is finished", async function () {
    await betVault.connect(address1).placeBid(3000, {value: ethers.utils.parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: ethers.utils.parseEther('0.5')});

    await expect(betVault.assesPrice()).to.be.revertedWith("It's not yet time to check prices");
  });
  it("Assess price", async function () {
    await betVault.connect(address1).placeBid(3000, {value: ethers.utils.parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: ethers.utils.parseEther('0.5')});
    await mineNBlocks(11);
    await betVault.assesPrice();
    const price = await betVault.priceFromOracle(); //299996245016

    expect(price.toNumber()).to.equal(2999);
  });
  it("Select a winner (1 winner)", async function () {
    await betVault.connect(address1).placeBid(3000, {value: ethers.utils.parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: ethers.utils.parseEther('0.5')});
    await betVault.connect(address3).placeBid(4000, {value: ethers.utils.parseEther('0.5')});
    await mineNBlocks(11);
    await betVault.assesPrice();
    await betVault.checkWhoWon();
    const winnersCount  = await betVault.winnersCount();

    expect(winnersCount).to.equal(1);
  });
  it("Select a winner (2 got the same bid)", async function () {
    await betVault.connect(address1).placeBid(3000, {value: ethers.utils.parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: ethers.utils.parseEther('0.5')});
    await betVault.connect(address3).placeBid(3000, {value: ethers.utils.parseEther('0.5')});
    await mineNBlocks(11);
    await betVault.assesPrice();
    await betVault.checkWhoWon();
    const winnersCount  = await betVault.winnersCount();

    expect(winnersCount).to.equal(2);
  });
  it("Withdraw reward (1 user)", async function () {
    await betVault.connect(address1).placeBid(2900, {value: ethers.utils.parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: ethers.utils.parseEther('0.5')});
    await mineNBlocks(11);
    const winnerBalanceBefore = await ethers.provider.getBalance(address1.address);
    const looserBalanceBefore = await ethers.provider.getBalance(address2.address);
    await betVault.close();
    const winnerBalanceAfter = await ethers.provider.getBalance(address1.address);
    const looserBalanceAfter = await ethers.provider.getBalance(address2.address);
    const contractBalanceAfter = await ethers.provider.getBalance(betVault.address);

    const resultMatrix = [winnerBalanceAfter.gt(winnerBalanceBefore), looserBalanceBefore.eq(looserBalanceAfter), contractBalanceAfter.isZero()];

    expect([true, true, true]).to.eql(resultMatrix);
  });
  it("Withdraw reward (2 users)", async function () {
    await betVault.connect(address1).placeBid(2900, {value: ethers.utils.parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: ethers.utils.parseEther('0.5')});
    await betVault.connect(address3).placeBid(3000, {value: ethers.utils.parseEther('0.5')});
    await mineNBlocks(11);
    const winnerBalanceBefore = await ethers.provider.getBalance(address3.address);
    const looser1BalanceBefore = await ethers.provider.getBalance(address1.address);
    const looser2BalanceBefore = await ethers.provider.getBalance(address2.address);
    await betVault.close();
    const winnerBalanceAfter = await ethers.provider.getBalance(address3.address);
    const looser1BalanceAfter = await ethers.provider.getBalance(address1.address);
    const looser2BalanceAfter = await ethers.provider.getBalance(address2.address);
    const contractBalanceAfter = await ethers.provider.getBalance(betVault.address);

    const resultMatrix = [winnerBalanceAfter.gt(winnerBalanceBefore), looser1BalanceBefore.eq(looser1BalanceAfter), looser2BalanceBefore.eq(looser2BalanceAfter), contractBalanceAfter.isZero()];

    expect([true, true, true, true]).to.eql(resultMatrix);
  });
});

async function mineNBlocks(n) {
  for (let index = 0; index < n; index++) {
    await ethers.provider.send('evm_mine');
  }
}
