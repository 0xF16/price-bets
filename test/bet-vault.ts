import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat"
import { parseEther, parseUnits } from "ethers/lib/utils";

const priceOracle = "0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8"; //Arbitrum Rinkeby ETH/USD price https://docs.chain.link/docs/arbitrum-price-feeds/

describe("BetVault contract deployment", () => {
  let BetVault : ContractFactory;
  let deployer : SignerWithAddress;

  before(async () => {
    [deployer] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
  });
  it("Cannot deploy a vault with bidding that ends before whole session end", async function () {

    await expect(BetVault.deploy(priceOracle, 1650884797, 1650884796)).to.be.revertedWith("Bidding time must be before whole bid ends");
  });

  it("Cannot deploy a vault with time that already passed", async function () {
    const lastBlockTime : number = await (await ethers.provider.getBlock("latest")).timestamp;

    await expect(BetVault.deploy(priceOracle, lastBlockTime-10, lastBlockTime+10)).to.be.revertedWith("Bidding must end after now");
  });
});

describe("BetVault placing bids", () => {
  let BetVault : ContractFactory;
  let betVault : Contract;
  let deployer : SignerWithAddress, address1 : SignerWithAddress, address2 : SignerWithAddress;

  before(async () => {
    [deployer, address1, address2] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
    const lastBlockTime : number = await (await ethers.provider.getBlock("latest")).timestamp;
    betVault = await BetVault.deploy(priceOracle, lastBlockTime+10, lastBlockTime+20);
  });
  it("Can place bids", async function () {
    await betVault.connect(address1).placeBid(3000, {value: parseEther('1')});
    const bet = await betVault.bets(address1.address);

    expect(bet.active).to.equal(true);
  });
  it("Cannot place new bets when there is a bet for that user already", async function () {

    await expect(betVault.connect(address1).placeBid(3000, {value: parseEther('1')})).to.be.revertedWith("Address already placed a bid");
  });
  it("Another user can place a new bid", async function () {
    await betVault.connect(address2).placeBid(3000, {value: parseEther('0.5')});

    expect(await ethers.provider.getBalance(betVault.address)).to.equal(parseUnits('1.5', 'ether'));
  });
});

describe("BetVault closing bets", () => {
  let BetVault : ContractFactory;
  let betVault : Contract;
  let deployer : SignerWithAddress, address1 : SignerWithAddress, address2 : SignerWithAddress, address3 : SignerWithAddress;

  beforeEach(async () => {
    [deployer, address1, address2, address3] = await ethers.getSigners();
    BetVault = await ethers.getContractFactory("BetVault");
    const lastBlockTime : number = await (await ethers.provider.getBlock("latest")).timestamp;
    betVault = await BetVault.deploy(priceOracle, lastBlockTime+10, lastBlockTime+11);
  });
  it("Withdraw reward (1 user)", async function () {
    await betVault.connect(address1).placeBid(2900, {value: parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: parseEther('0.5')});
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
    await betVault.connect(address1).placeBid(2900, {value: parseEther('1')});
    await betVault.connect(address2).placeBid(3500, {value: parseEther('0.5')});
    await betVault.connect(address3).placeBid(3000, {value: parseEther('0.5')});
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

async function mineNBlocks(n : number) {
  for (let index = 0; index < n; index++) {
    await ethers.provider.send('evm_mine', []);
  }
}
