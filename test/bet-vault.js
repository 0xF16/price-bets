const { expect } = require("chai");
const { ethers } = require("hardhat");

const priceOracle = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"; //Arbitrum Mainnet ETH/USD price https://docs.chain.link/docs/arbitrum-price-feeds/

describe("BetVault contract deployment", () => {
  let BetVault;
  let deployer;

  before(async () => {
    [deployer] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
  });
  it("Cannot deploy a vault with bidding that ends before whole session end", async function () {

    await expect(BetVault.deploy(deployer.address, priceOracle, 1650884797, 1650884796)).to.be.revertedWith("Bidding time must be before whole bid ends");
  });

  it("Cannot deploy a vault with time that already passed", async function () {
    let lastBlockTime = await ethers.provider.getBlock("latest");
    lastBlockTime = lastBlockTime.timestamp;

    await expect(BetVault.deploy(deployer.address, priceOracle, lastBlockTime-10, lastBlockTime+10)).to.be.revertedWith("Bidding must end after now");
  });
});

describe("BetVault placing bets", () => {
  let BetVault;
  let betVault;
  let deployer, address1, address2;

  before(async () => {
    [deployer, address1, address2] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
    let lastBlockTime = await ethers.provider.getBlock("latest");
    lastBlockTime = lastBlockTime.timestamp;
    betVault = await BetVault.deploy(deployer.address, priceOracle, lastBlockTime+10, lastBlockTime+20);
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
