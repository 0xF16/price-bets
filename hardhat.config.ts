import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle';
import { HardhatUserConfig } from "hardhat/config";

import dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ARBITRUM_RINKEBY_API_KEY ?? '',
        blockNumber: 11444444
      }
    },
    arbitrumRinkeby: {
      url: process.env.ARBITRUM_RINKEBY_API_KEY,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      }
    },
    optimismKovan: {
      url: process.env.OPTIMISM_KOVAN_API_KEY,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      }
    },
  }
};

export default config;