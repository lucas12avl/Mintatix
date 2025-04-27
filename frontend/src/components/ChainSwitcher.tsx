import { useSwitchChain } from "wagmi";

//chainid can be a number or undefined that's why we use the ? operator

const ChainSwitcher = ({chainId, targetChainId}: {chainId?: number, targetChainId?: number }) =>{

    const {chains, switchChain} = useSwitchChain()

    if (!chains || chainId === targetChainId) return null; //if the chainId is undefined or the user is in the right chain, then don't show anything
    
    const chainName = targetChainId === 1 ? 'Mainnet' : targetChainId === 31337 ? 'Hardhat' : 'Sepolia';
    
    return(
        <div className="modal-overlay">
          <div className="modal-content">
            
            <p> To interact with the Dapp, please change your wallet network to {chainName}. </p>

            <button className="button" onClick={() => switchChain && switchChain({ chainId: targetChainId as 1 | 31337 | 11155111 })}> {/* the target id can be Mainnet, hardhat or sepolia*/}
              Change to {chainName}
            </button>

          </div>
        </div>
    );


}

export default ChainSwitcher;