import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, ContractFactory, Transaction } from "ethers";
import { ethers } from "hardhat"
import { parseEther, parseUnits } from "ethers/lib/utils";

const priceOracle = "0x5f0423B1a6935dc5596e7A24d98532b67A0AeFd8"; //Arbitrum Rinkeby ETH/USD price https://docs.chain.link/docs/arbitrum-price-feeds/

describe("BetVault contract deployment", () => {
  let BetVault : ContractFactory;
  let BetVaultFactory : ContractFactory;

  let betVault : Contract;
  let betVaultFactory : Contract;

  let lastBlockTime : number;

  before(async () => {
    lastBlockTime = (await ethers.provider.getBlock("latest")).timestamp;

    BetVault = await ethers.getContractFactory("BetVault");
    BetVaultFactory = await ethers.getContractFactory("BetVaultFactory");

    betVault = await BetVault.deploy();
    betVaultFactory = await BetVaultFactory.deploy(betVault.address);
  });
  it("Cannot initialize anything on the original of the smart-contract that would be copied multiple times", async function () {
    await expect(betVault.initialize(priceOracle, lastBlockTime+1, lastBlockTime+2)).to.be.revertedWith("FORBIDDEN");
  });
  it("Cannot deploy a vault with bidding that ends before whole session end", async function () {
    await expect(betVaultFactory.createVault(priceOracle, lastBlockTime+2, lastBlockTime+1)).to.be.revertedWith("Bidding time must be before whole bid ends");
  });

  it("Cannot deploy a vault with time that already passed", async function () {
    await expect(betVaultFactory.createVault(priceOracle, lastBlockTime-10, lastBlockTime+10)).to.be.revertedWith("Bidding must end after now");
  });
});

describe("BetVault placing bids", () => {
  let BetVault : ContractFactory;
  let betVault : Contract;

  let BetVaultFactory : ContractFactory;
  let betVaultFactory : Contract;

  let deployer : SignerWithAddress, address1 : SignerWithAddress, address2 : SignerWithAddress;

  let betVaultCopy : Contract;

  before(async () => {
    const lastBlockTime : number = (await ethers.provider.getBlock("latest")).timestamp;
    [deployer, address1, address2] = await ethers.getSigners();

    BetVault = await ethers.getContractFactory("BetVault");
    betVault = await BetVault.deploy();

    BetVaultFactory = await ethers.getContractFactory("BetVaultFactory");
    betVaultFactory = await BetVaultFactory.deploy(betVault.address);

    let vaultAddress : string = await betVaultFactory.callStatic.createVault(priceOracle, lastBlockTime+10, lastBlockTime+20);
    await betVaultFactory.createVault(priceOracle, lastBlockTime+10, lastBlockTime+20);
    betVaultCopy = await ethers.getContractAt("BetVault", vaultAddress);
  });
  it("Can place bids", async function () {
    await betVaultCopy.connect(address1).placeBid(3000, {value: parseEther('1')});
    const bet = await betVaultCopy.bets(address1.address);

    expect(bet.active).to.equal(true);
  });
  it("Cannot place new bets when there is a bet for that user already", async function () {

    await expect(betVaultCopy.connect(address1).placeBid(3000, {value: parseEther('1')})).to.be.revertedWith("Address already placed a bid");
  });
  it("Another user can place a new bid", async function () {
    await betVaultCopy.connect(address2).placeBid(3000, {value: parseEther('0.5')});

    expect(await ethers.provider.getBalance(betVaultCopy.address)).to.equal(parseUnits('1.5', 'ether'));
  });
});

// describe("BetVault closing bets", () => {
//   let BetVault : ContractFactory;
//   let betVault : Contract;
//   let deployer : SignerWithAddress, address1 : SignerWithAddress, address2 : SignerWithAddress, address3 : SignerWithAddress;

//   beforeEach(async () => {
//     [deployer, address1, address2, address3] = await ethers.getSigners();
//     BetVault = await ethers.getContractFactory("BetVault");
//     const lastBlockTime : number = await (await ethers.provider.getBlock("latest")).timestamp;
//     betVault = await BetVault.deploy(priceOracle, lastBlockTime+10, lastBlockTime+11);
//   });
//   it("Withdraw reward (1 user)", async function () {
//     await betVault.connect(address1).placeBid(2900, {value: parseEther('1')});
//     await betVault.connect(address2).placeBid(3500, {value: parseEther('0.5')});
//     await mineNBlocks(11);
//     const winnerBalanceBefore = await ethers.provider.getBalance(address1.address);
//     const looserBalanceBefore = await ethers.provider.getBalance(address2.address);
//     await betVault.close();
//     const winnerBalanceAfter = await ethers.provider.getBalance(address1.address);
//     const looserBalanceAfter = await ethers.provider.getBalance(address2.address);
//     const contractBalanceAfter = await ethers.provider.getBalance(betVault.address);

//     const resultMatrix = [winnerBalanceAfter.gt(winnerBalanceBefore), looserBalanceBefore.eq(looserBalanceAfter), contractBalanceAfter.isZero()];

//     expect([true, true, true]).to.eql(resultMatrix);
//   });
//   it("Withdraw reward (2 users)", async function () {
//     await betVault.connect(address1).placeBid(2900, {value: parseEther('1')});
//     await betVault.connect(address2).placeBid(3500, {value: parseEther('0.5')});
//     await betVault.connect(address3).placeBid(3000, {value: parseEther('0.5')});
//     await mineNBlocks(11);
//     const winnerBalanceBefore = await ethers.provider.getBalance(address3.address);
//     const looser1BalanceBefore = await ethers.provider.getBalance(address1.address);
//     const looser2BalanceBefore = await ethers.provider.getBalance(address2.address);
//     await betVault.close();
//     const winnerBalanceAfter = await ethers.provider.getBalance(address3.address);
//     const looser1BalanceAfter = await ethers.provider.getBalance(address1.address);
//     const looser2BalanceAfter = await ethers.provider.getBalance(address2.address);
//     const contractBalanceAfter = await ethers.provider.getBalance(betVault.address);

//     const resultMatrix = [winnerBalanceAfter.gt(winnerBalanceBefore), looser1BalanceBefore.eq(looser1BalanceAfter), looser2BalanceBefore.eq(looser2BalanceAfter), contractBalanceAfter.isZero()];

//     expect([true, true, true, true]).to.eql(resultMatrix);
//   });
// });

async function mineNBlocks(n : number) {
  for (let index = 0; index < n; index++) {
    await ethers.provider.send('evm_mine', []);
  }
}
