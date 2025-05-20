import {useBalance, useAccount} from 'wagmi';

import './css/AccountHeader.css';


const AccountHeader = ({address, onClick}: {address: string, onClick: () => void}) =>{ //void bc won't return anything, just the callback to activate the disconnect
    const account = useAccount();
    const shortenedAddress = (addr: string) => addr.substring(1, 6) + '...' + addr.substring(39, 43);

    //fetch the balance with wagmi , and if it's loading to show smthg meanwhile 
    const { data: balanceData, isLoading} = useBalance({address: account.address}) //useBalance reftech automatically the balance when the user sends a tx with another wagmi hook

    const getBalance = () => {
        if (isLoading) return 'Loading...'; //if the balance is loading, show this message
        if (balanceData?.value){ // ? --> checks if teh object balanceData it's undefined or not, value is a bignint should be a number

            const eth = Number(balanceData.value) / 10 ** balanceData.decimals; //convert the balance to eth, bc the balance is in wei
            return eth.toFixed(4); //convert to string with 4 decimals
        }
        return '0.0000'; //if smth goes wrong, return this
        
    }

    const balance = getBalance(); 

    return(
        <div className='account-header' onClick={onClick}> {/*onClick will show the disconnect component*/}
            <span className='balance'> {balance} ETH</span>
            <span>{shortenedAddress(address)}</span>
        </div>
    )



}

export default AccountHeader;