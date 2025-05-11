import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { parseUnits, formatUnits } from 'viem';

import eventLogicContract from '../../contracts/EventTicketLogic.json';
import { SelectedTicketState, TicketStatus, DetailedStatus, CountdownState } from './Interfaces';
import { formatEventTimestamp } from '../utils';

import { solidityPackedKeccak256 } from 'ethers';
import { IoClose } from 'react-icons/io5';
import { QRCodeCanvas } from 'qrcode.react';
import { BsFillCalendarWeekFill } from 'react-icons/bs';
import { MdLocationOn } from 'react-icons/md';

const LOCAL_KEY = 'ticketRedemptionCountdown';//this is the begining of every key in order to know tht belongs to this component
const getStorageKey = (tokenId: string, eventAddress: string) => `${LOCAL_KEY}-${eventAddress}-${tokenId}`;
const getNonceStorageKey = (tokenId: string, eventAddress: string) => `${LOCAL_KEY}-nonce-${eventAddress}-${tokenId}`;
//function to represent the timer for the user 
const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const TicketDetailModal = ({ isOpen, onClose, onStatusChange, selectedTicket }: { isOpen: boolean, onClose: () => void, onStatusChange: () => Promise<void>, selectedTicket: SelectedTicketState }) => {

    const { address: userAddress } = useAccount();

    const [isRedeeming, setIsRedeeming] = useState(false);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [countdownEndTime, setCountdownEndTime] = useState<number | null>(null);
    const [remainingTime, setRemainingTime] = useState<number | null>(null);
    const [newSalePriceInput, setNewSalePriceInput] = useState('');
    const [isProcessingPriceChange, setIsProcessingPriceChange] = useState(false);
    const [isCancellingSale, setIsCancellingSale] = useState(false);
    const [secretNonce, setSecretNonce] = useState<`0x${string}` | null>(null);
    const [commitHash, setCommitHash] = useState<`0x${string}` | null>(null);
    const lastNotifiedStatus = useRef<DetailedStatus | null>(null);

    const { data: ticketPriceData, isLoading: isLoadingTicketPrice } = useReadContract({
        address: selectedTicket.eventAddress,
        abi: eventLogicContract.abi,
        functionName: 'ticketPrice',
    });

    const ticketPriceWei = ticketPriceData as bigint | undefined; //if it's undefined we can assure thta there was an error or it's still loading

    /*writes that the modal can make */
    const { data: redeemTxHash, writeContract: redeemWrite, isPending: isPendingRedeem, error: redeemError } = useWriteContract();
    const { isSuccess: isSuccessRedeem, isLoading: isLoadingRedeemSuccess } = useWaitForTransactionReceipt({ hash: redeemTxHash });

    const { data: priceChangeTxHash, writeContract: priceChangeWrite, isPending: isPendingPriceChange } = useWriteContract();
    const { isSuccess: isSuccessPriceChange, isLoading: isLoadingPriceChange } = useWaitForTransactionReceipt({ hash: priceChangeTxHash });

    const { data: cancelSaleTxHash, writeContract: cancelSaleWrite, isPending: isPendingCancelSale } = useWriteContract();
    const { isSuccess: isSuccessCancelSale, isLoading: isLoadingCancelSaleSuccess } = useWaitForTransactionReceipt({ hash: cancelSaleTxHash });

    /* countdown of pending ticktes  */
    //tgis fucntion will set the info and save it in the localstoratge just in case the user leaves the Dapp
    const startCountdown = useCallback((duration: number, commit: `0x${string}`, nonce: `0x${string}`) => {
        const now = Date.now();
        const end = now + duration * 1000;
        setCountdownEndTime(end);
        setIsCountingDown(true);
        setIsRedeeming(false);
        setCommitHash(commit);
        setSecretNonce(nonce);

        const state: CountdownState = {
            tokenId: selectedTicket.tokenID.toString(),
            eventAddress: selectedTicket.eventAddress,
            startTime: now,
            duration,
            commitHash: commit,
            secretNonce: nonce
        };
        // this key will be like "ticketRedemptionCountdown-0xAbC...123-4"
        const fullKey = getStorageKey(selectedTicket.tokenID.toString(), selectedTicket.eventAddress);
        localStorage.setItem(fullKey, JSON.stringify(state)); //save the countdown state, if the user leave the Dapp then we can recovery and continuing the countdown

        //and this key will be "ticketRedemptionCountdown-nonce-0xAbC...123-4" --> when the trasnaction is not accepted by the user, 
        // we only save the nonce just in case the user have to leave the Dapp (for example, in mobile the user has to jump to the metamskApp so, we have to remember the random nonce bc when the tx is sended the smart contract got a hash created with THIS nonce)
        const nonceKey = getNonceStorageKey(selectedTicket.tokenID.toString(), selectedTicket.eventAddress);
        localStorage.removeItem(nonceKey);
    }, [selectedTicket.eventAddress, selectedTicket.tokenID]);


    //if the component is active, first of all load the localstorage data (if there is smthg)
    useEffect(() => {
        if (!isOpen) {
            setIsCountingDown(false);
            setCountdownEndTime(null);
            setRemainingTime(null);
            setSecretNonce(null);
            setCommitHash(null);
            setIsRedeeming(false);
            return;
        }

        const nonceKey = getNonceStorageKey(selectedTicket.tokenID.toString(), selectedTicket.eventAddress);
        const partialNonce = localStorage.getItem(nonceKey);
        if (partialNonce) { //if there is a nonce in the localStoratge with this key, it means the user is trying to redeem the ticket
            setSecretNonce(partialNonce as `0x${string}`); // save the secretNonce thta the user generate in the previous openeing of this ticket 
        }

        //this if we have a fullKey it means that the user has put his ticket in pending in order to redeeem it 
        const fullKey = getStorageKey(selectedTicket.tokenID.toString(), selectedTicket.eventAddress);
        const saved = localStorage.getItem(fullKey);
        if (saved) {
            try {
                const state = JSON.parse(saved) as CountdownState;
                //if it's the same ticket and the same state (pending) then we have to continue the timer 
                if (state.tokenId === selectedTicket.tokenID.toString() && state.eventAddress === selectedTicket.eventAddress) {
                    const end = state.startTime + state.duration * 1000;
                    const now = Date.now();
                    if (now < end) { //if timer not expired, recreate it 
                        startCountdown(Math.floor((end - now) / 1000), state.commitHash, state.secretNonce);
                    } else { //if expired remove the state 
                        localStorage.removeItem(fullKey);
                        onStatusChange();
                    }
                }
            } catch {
                localStorage.removeItem(fullKey); //if smthg went wrong better to remove and start again
            }
        } else {
            if (!partialNonce) { //if the partial nonce does not exist, remove the secretNonce just in case to not use again in the future
                setSecretNonce(null);
            }
        }
    }, [isOpen, selectedTicket.tokenID, selectedTicket.eventAddress, startCountdown, onStatusChange]);

    //useEffect for the timer, this useEffect counts second by second 
    useEffect(() => {
        //if we don't have a timer or an andtime for the timer, clean the remaining time 
        if (!isCountingDown || countdownEndTime === null) {
            setRemainingTime(null);
            return;
        }
        //get the fullkey and recreate the timer in order to continuing with it or recalculing how much time is left 
        const fullKey = getStorageKey(selectedTicket.tokenID.toString(), selectedTicket.eventAddress);
        const tick = () => { //every tick is 1 second till finishes, then clean all the states 
            const now = Date.now();
            const left = Math.max(0, Math.floor((countdownEndTime - now) / 1000));
            setRemainingTime(left);

            if (left === 0) {

                clearInterval(id);
                setIsCountingDown(false);
                setCountdownEndTime(null);
                setSecretNonce(null);
                setIsRedeeming(false);
                localStorage.removeItem(fullKey);
                onStatusChange();
            }
        };
        tick();
        const id = setInterval(tick, 1000);// will execute every sec
        return () => clearInterval(id); // if this useEffect is cllaed a second time, runs this return, (returns in useEffects are mostly used as cleaners bc executes when the component it's being closed)
        //when one of the depnedency changes the return is called cleaning the interval, is usefull to not have intervals running with a closed component 
    }, [isCountingDown, countdownEndTime, selectedTicket.tokenID, selectedTicket.eventAddress, onStatusChange]);

    const isOnSaleByUser = useMemo(() => ( //if the ticket is onSale the modal we show the cancel button, and an input to update the price --> its only used to calculate the final status
        selectedTicket.ticketInfo.seller === userAddress && selectedTicket.ticketInfo.salePrice > 0n

    ), [selectedTicket.ticketInfo.seller, selectedTicket.ticketInfo.salePrice, userAddress]);

    //the final status of the ticket 
    let finalStatus: DetailedStatus;
    let isEffectivelyPendingByTime = false; //calc if the ticket is pending by the time not by the status bc staus can't change as an event in the smart contract
    if (selectedTicket.ticketInfo.status === TicketStatus.Pending) {
        const nowSec = BigInt(Math.floor(Date.now() / 1000));
        const expiresSec = selectedTicket.ticketInfo.pendingSince + selectedTicket.pendingDurationEvent;
        if (expiresSec > nowSec) {
            isEffectivelyPendingByTime = true;
        }
    }
    if (selectedTicket.ticketInfo.status === TicketStatus.Redeemed) {
        finalStatus = 'Redeemed';
    } else if (selectedTicket.ticketInfo.seller === userAddress && selectedTicket.ticketInfo.salePrice > 0n) {
        finalStatus = 'OnSale';
    } else if (isCountingDown) { //if true this is the device that has put the ticket on pending

        if (remainingTime !== null && remainingTime > 0) {
            finalStatus = 'Pending';
        } else {
            finalStatus = isEffectivelyPendingByTime ? 'Pending' : 'Active';
        }
    } else if (isEffectivelyPendingByTime) { //if true, menas that the the ticket is pending but in another device or session

        finalStatus = 'Pending';
    } else {

        finalStatus = 'Active';
    }

    useEffect(() => { //if the user changes the state of the ticket is important to refetch the info in myTickets component to show the new state

        if (finalStatus !== lastNotifiedStatus.current) {
            lastNotifiedStatus.current = finalStatus;
            onStatusChange?.();
        }
    }, [finalStatus, onStatusChange]);

    useEffect(() => {
        if (isSuccessRedeem) {
            onStatusChange().then(() => {
                if (commitHash && secretNonce) {
                    startCountdown(Number(selectedTicket.pendingDurationEvent), commitHash, secretNonce);
                } else {
                    setIsRedeeming(false);
                }
            });
        }
    }, [isSuccessRedeem, onStatusChange, selectedTicket.pendingDurationEvent, commitHash, secretNonce, startCountdown]);


    useEffect(() => {
        if (redeemError) {
            setIsRedeeming(false);
            const nonceKey = getNonceStorageKey(selectedTicket.tokenID.toString(), selectedTicket.eventAddress);
            localStorage.removeItem(nonceKey);
        }
    }, [redeemError, selectedTicket.tokenID, selectedTicket.eventAddress]);

    //price change and cancel sale effects in order to comunicate to the parent
    useEffect(() => {
        if (isSuccessPriceChange) {
            setNewSalePriceInput('');
            setIsProcessingPriceChange(false);
            onStatusChange();
        }
    }, [isSuccessPriceChange, onStatusChange]);

    useEffect(() => {
        if (isSuccessCancelSale) {
            setIsCancellingSale(false);
            onStatusChange();
        }
    }, [isSuccessCancelSale, onStatusChange]);

    //handlers to manage the user actions
    const handleRedeem = () => {
        if (isPendingRedeem || isLoadingRedeemSuccess || isCountingDown || isRedeeming || isOnSaleByUser || finalStatus !== 'Active') {
            return;
        }
        setIsRedeeming(true);

        const nonceArr = new Uint8Array(32);
        crypto.getRandomValues(nonceArr); //generate the random nonce
        // create the nonce in hexadecimal
        const localNonceHex = ('0x' + Array.from(nonceArr, b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
        // create the hash with the nonce and the tokenID
        const localHash = solidityPackedKeccak256(['uint256', 'bytes32'], [selectedTicket.tokenID, localNonceHex]) as `0x${string}`;

        const nonceKey = getNonceStorageKey(selectedTicket.tokenID.toString(), selectedTicket.eventAddress);
        localStorage.setItem(nonceKey, localNonceHex);

        setSecretNonce(localNonceHex);
        setCommitHash(localHash);

        redeemWrite(
            {
                address: selectedTicket.eventAddress,
                abi: eventLogicContract.abi,
                functionName: 'setPendingToTKT',
                args: [selectedTicket.tokenID, localHash]
            },
            {
                onSuccess: () => {
                    console.log('transaction sent successfully');
                },
                onError: (error: any) => {
                    console.error('Something went wrong sending the transaction: ', error);
                    setIsRedeeming(false);
                    localStorage.removeItem(nonceKey);
                    alert(`Transaction rejected or failed to send: ${error.message}`);
                }
            }
        );
    };



    const handlePriceChange = () => {
        if (isPendingPriceChange || isLoadingPriceChange || isProcessingPriceChange || isRedeeming || isCountingDown || !newSalePriceInput || isLoadingTicketPrice || ticketPriceWei === undefined) return;
        try {
            const normalized = newSalePriceInput.replace(',', '.');
            const newPriceWei = parseUnits(normalized, 18);
            const maxPriceWei = (ticketPriceWei * 130n) / 100n;
            if (newPriceWei <= 0n) { alert('Price must be positive.'); return; }
            if (newPriceWei > maxPriceWei) { alert(`Price cannot exceed ${formatUnits(maxPriceWei, 18)} ETH (130% of original price).`); return; }
            setIsProcessingPriceChange(true);
            priceChangeWrite(
                {
                    address: selectedTicket.eventAddress,
                    abi: eventLogicContract.abi,
                    functionName: 'addTicketsForSale',
                    args: [selectedTicket.tokenID, newPriceWei]
                },
                {
                    onSuccess: () => console.log("Price change tx submitted."),
                    onError: (error) => { alert(`Failed to list ticket: ${error.message}`); setIsProcessingPriceChange(false); }
                }
            );
        } catch (e: any) {
            alert('Invalid price format. Please enter a number (e.g., 0.1).');
            setIsProcessingPriceChange(false);
        }
    };

    const handleCancelSale = () => {
        if (isPendingCancelSale || isLoadingCancelSaleSuccess || isCancellingSale || !isOnSaleByUser || isRedeeming || isCountingDown) return;

        setIsCancellingSale(true);
        cancelSaleWrite(
            {
                address: selectedTicket.eventAddress,
                abi: eventLogicContract.abi,
                functionName: 'cancelTicketForSale',
                args: [selectedTicket.tokenID]
            },
            {
                onError: (error) => { alert(`Failed to cancel sale: ${error.message}`); setIsCancellingSale(false); }
            }
        );
    };

    const qrValue = useMemo(() => ( //crete the JSON that the qr wil show
        isCountingDown && secretNonce
            ? JSON.stringify({ tokenID: selectedTicket.tokenID.toString(), secretNonce })
            : null
    ), [isCountingDown, secretNonce, selectedTicket.tokenID]);

    const priceChangeButtonText = isProcessingPriceChange
        ? 'Processing…'
        : isOnSaleByUser
            ? 'Update Price'
            : 'List for Sale';
    const cancelSaleButtonText = isCancellingSale ? 'Processing…' : 'Cancel Sale';
    const redeemButtonText = isRedeeming || isPendingRedeem || isLoadingRedeemSuccess ? 'Redeeming…' : 'Redeem';

    const approxExpiryTime = useMemo(() => {
        if (finalStatus === 'Pending' && !isCountingDown) {
            const nowSec = Math.floor(Date.now() / 1000);
            const expiresSec = Number(selectedTicket.ticketInfo.pendingSince) + Number(selectedTicket.pendingDurationEvent);
            const timeToExpire = Math.max(0, expiresSec - nowSec);
            return timeToExpire > 0 ? formatTime(timeToExpire) : null;
        }
        return null;

    }, [finalStatus, isCountingDown, selectedTicket.pendingDurationEvent, selectedTicket.ticketInfo.pendingSince]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose} aria-label="Close">
                    <IoClose />
                </button>

                {selectedTicket.image ? (
                    <img src={selectedTicket.image} alt={selectedTicket.image} className="ticket-detail-modal__image" />
                ) : (
                    <p className="message info-message">No image available</p>
                )}

                <h2 className="ticket-detail-modal__name">{selectedTicket.name}</h2>

                <p className="ticket-detail-modal__description">{selectedTicket.description}</p>
                <div className="ticket-detail-modal__meta">
                    <p>
                        <BsFillCalendarWeekFill aria-hidden="true" />
                        {formatEventTimestamp(Number(selectedTicket.eventEndTime))}
                    </p>
                    <p>
                        <MdLocationOn aria-hidden="true" />
                        {selectedTicket.location}
                    </p>
                </div>

                <div className="ticket-detail-modal__status-badge-container">
                    <span className={`ticket-detail-modal__status-badge status--${finalStatus.toLowerCase()}`}>
                        Status: {finalStatus}
                        {isCountingDown && remainingTime !== null && ` (${formatTime(remainingTime)})`}
                    </span>
                </div>

                {isOnSaleByUser && ticketPriceWei !== undefined && (
                    <div className="ticket-detail-modal__price-info">
                        <p>Original Price: {formatUnits(ticketPriceWei, 18)} ETH</p>
                        <p><strong>Current Sale Price: {formatUnits(selectedTicket.ticketInfo.salePrice, 18)} ETH</strong></p>
                    </div>
                )}

                <div className="ticket-detail-modal__actions">
                    {isCountingDown && qrValue && remainingTime !== null ? (
                        <div className="ticket-detail-modal__redeem-active">
                            <p>Scan QR to complete redemption:</p>
                            <div className="ticket-detail-modal__qr-container">
                                <QRCodeCanvas value={qrValue} size={160} bgColor="#ffffff" fgColor="#1e1e1e" />
                            </div>
                        </div>
                    ) : finalStatus === 'Pending' && !isCountingDown ? (
                        <div className="ticket-detail-modal__pending-elsewhere">
                            <p><strong>Redemption Pending</strong></p>
                            <p>This ticket's redemption process was likely started on another device or browser session.</p>
                            {approxExpiryTime ? (
                                <p>Please complete the redemption there, or wait until it expires (approx. <strong>{approxExpiryTime}</strong>).</p>
                            ) : (
                                <p>Please complete the redemption there, or wait for the pending period to expire.</p>
                            )}
                        </div>
                    ) : isRedeeming || isPendingRedeem || isLoadingRedeemSuccess ? (
                        <div className="ticket-detail-modal__redeem-active">
                            <p className="message loading-message">{redeemButtonText}</p>
                            {redeemTxHash && <p className="message info-message">Tx: {redeemTxHash.slice(0, 6)}…{redeemTxHash.slice(-4)}</p>}
                        </div>
                    ) : finalStatus === 'Active' ? (
                        <button
                            className="ticket-detail-modal__action-button redeem"
                            onClick={handleRedeem}
                            disabled={isRedeeming || isPendingRedeem || isLoadingRedeemSuccess}
                        >
                            {redeemButtonText}
                        </button>
                    ) : null}

                    {(finalStatus === 'Active' || (finalStatus === 'OnSale' && isOnSaleByUser)) &&
                        !isRedeeming && !isCountingDown && !isPendingRedeem && !isLoadingRedeemSuccess && (
                            <>
                                {(!isCountingDown && finalStatus === 'Active') && <hr className="ticket-detail-modal__divider--actions" />}

                                <h3 className="ticket-detail-modal__action-header">
                                    {isOnSaleByUser ? 'Update Sale Price' : 'List for Resale'}
                                </h3>
                                {ticketPriceWei !== undefined && !isLoadingTicketPrice ? (
                                    <p className="ticket-detail-modal__resale-info">
                                        Max Listing Price: {formatUnits((ticketPriceWei * 130n) / 100n, 18)} ETH (130%)
                                    </p>
                                ) : isLoadingTicketPrice ? (
                                    <p className="message loading-message">Loading price info...</p>
                                ) : (
                                    <p className="message error-message">Could not load original price.</p>
                                )}

                                {ticketPriceWei !== undefined && !isLoadingTicketPrice && (
                                    <div className="ticket-detail-modal__sell-form">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="New Price (ETH)"
                                            value={newSalePriceInput}
                                            onChange={e => {   
                                                const v = e.target.value.replace(',', '.');
                                                if (/^\d*(?:[.,]\d*)?$/.test(e.target.value)) {
                                                    setNewSalePriceInput(v);
                                                }
                                            }}
                                            className="ticket-detail-modal__sell-input"
                                            disabled={
                                                isPendingPriceChange || isLoadingPriceChange || isProcessingPriceChange ||
                                                isPendingCancelSale || isLoadingCancelSaleSuccess || isCancellingSale
                                            }
                                        />
                                        <button
                                            className="ticket-detail-modal__action-button sell"
                                            onClick={handlePriceChange}
                                            disabled={
                                                isPendingPriceChange || isLoadingPriceChange || isProcessingPriceChange ||
                                                !newSalePriceInput ||
                                                isPendingCancelSale || isLoadingCancelSaleSuccess || isCancellingSale
                                            }
                                        >
                                            {priceChangeButtonText}
                                        </button>
                                    </div>
                                )}
                                {isOnSaleByUser && (
                                    <button
                                        className="ticket-detail-modal__action-button cancel-sale"
                                        onClick={handleCancelSale}
                                        disabled={
                                            isPendingCancelSale || isLoadingCancelSaleSuccess || isCancellingSale ||
                                            isPendingPriceChange || isLoadingPriceChange || isProcessingPriceChange
                                        }
                                    >
                                        {cancelSaleButtonText}
                                    </button>
                                )}
                            </>
                        )}
                </div>
            </div>
        </div>
    );

}

export default TicketDetailModal;