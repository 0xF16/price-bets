import { Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";

async function main() {
  // We get the contract to deploy
  const BetVault : ContractFactory = await ethers.getContractFactory("BetVault");
  const betVault : Contract = await BetVault.deploy('0x7f8847242a530E809E17bF2DA5D2f9d2c4A43261', 1651011900, 1651011900);

  await betVault.deployed();

  console.log("BetVault deployed to:", betVault.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
