import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, hardhat} from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { metaMask } from '@wagmi/connectors'

/*OBS IMPORTANT: 
For Wagmi, the HardHat RPC is 127.0.0.1:8545, which is correct if you only want to use it on the same PC.
However, if you want to use HardHat from an external device, for calls to the local HardHat node to work, you have to change the RPC of the localhost to the IP that we have within the network that we are not connected to. 
Otherwise, an external device will make the RPC call to his own loclahost 
and there will be nothing on his loclahost. You must request the RPC to the IP OF THIS DEVICE

*/

// const hardhat2 = {
//   ...hardhat,
//   rpcUrls: {
//     default: { http: ['http://192.168.1.15:8545'] },  // Change this to the IP of the machine on the network you are on
//     public: { http: ['http://192.168.1.15:8545'] },
//   },
// }

export const config = createConfig({
  chains: [mainnet, sepolia, hardhat],
  connectors: [
    metaMask({
      dappMetadata: {
      name: 'Mintatix',
      url: 'https://mintatix.com', //purchase the domain ?? nahh 
      iconUrl: 'https://dweb.link/ipfs/bafkreifkcbkj4t2ass5gjm7oriq2odo3ibl43qucqcpzgsmyvtm23vth3i', 
    }}),
  
    coinbaseWallet({appName: 'Mintatix', appLogoUrl: '../icons/mintatix_ico_transparent.png'}),
    injected(),
    walletConnect({projectId: import.meta.env.VITE_WC_PROJECT_ID})
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [hardhat.id]: http(),

  },

})

declare module 'wagmi' { //added a new element to the wagmi module
  interface Register {
    config: typeof config //add the config property that we have generated
  }
}
