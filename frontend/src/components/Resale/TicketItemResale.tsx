import { TicketData } from '../MyTickets/Interfaces.ts';
import { formatUnits } from 'viem';

const TicketItemResale = ({ ticketData, remainingAllowancePerUser, isBuying, onBuy }: { ticketData: TicketData, remainingAllowancePerUser: number, isBuying: boolean, onBuy: (tokenId: bigint, salePrice: bigint) => void }) => {


    const imageCid = String(ticketData.metadata?.image).replace(/^ipfs:\/\//, '');

    return (
        <div className="resale-ticket-item">
            <div className="resale-ticket-image-container">
                {imageCid ? (
                    <img
                        src={`https://dweb.link/ipfs/${imageCid}`}
                        alt={`Ticket ${ticketData.id.toString()}`}
                        className="resale-ticket-image"
                    />
                ) : (
                    <div className="resale-ticket-placeholder">Img N/A</div>
                )}
            </div>
            <div className="resale-ticket-details">
                <p className="resale-ticket-id">Token ID: {ticketData.id.toString()}</p>
                <p className="resale-ticket-price">
                    Price: <strong>{formatUnits(ticketData.info.salePrice, 18)} ETH</strong>
                </p>
            </div>
            <button
                className="button button-primary resale-ticket-buy-button"
                onClick={() => onBuy(ticketData.id, ticketData.info.salePrice)}
                disabled={
                    isBuying ||
                    remainingAllowancePerUser <= 0
                }
            >
                {isBuying ? 'Buying...' : 'Buy'}
            </button>
        </div>
    );



}

export default TicketItemResale;