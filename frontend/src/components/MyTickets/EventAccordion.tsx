import {useState} from 'react';
import TicketItem from './TicketItem.tsx';

import type { TicketData } from './Interfaces.ts';
import type { EventData } from './Interfaces.ts';

import { PiTriangleFill } from 'react-icons/pi';
import { TicketMetadata } from './Interfaces.ts';

import '../css/MyTickets/EventAccordion.css';

const EventAccordion = ({event, onTicketClick}: {event: EventData, onTicketClick: (d: { eventAddress: `0x${string}`; ticket: TicketData, metadata: TicketMetadata | null; imageUrl: string | undefined;  eventEndTime?: bigint; location?: string; }) => void}) => {

    const [open, setOpen] = useState(false);

    const coverImage = (event.eventMetadata?.coverImage ?? '').replace(/^ipfs:\/\//, '');
    const name = (event.eventMetadata?.name ?? '');

    return (
        <div className="my-tickets-event-accordion">
          <button
            className={`my-tickets-event-header ${open ? 'open' : ''}`}
            style={{backgroundImage: `url(https://dweb.link/ipfs/${coverImage})`}}
            onClick={() => setOpen(!open)}
          >
            <div className="my-tickets-event-header-content">
              <span className="my-tickets-event-name">{name || event.address}</span>
              <span className="my-tickets-ticket-count">({event.ownedTickets.length})</span>
              <span className="my-tickets-accordion-icon"><PiTriangleFill /></span>
            </div>
          </button>
    
          {open && (
            <div className={`my-tickets-event-content ${open ? 'open' : ''}`}>
              {event.ownedTickets.map(t => (
                <TicketItem
                  key={`${event.address}-${t.id}`}
                  eventAddress = {event.address as `0x${string}`}
                  ticket={t}
                  pendingDuration={event.pendingDuration?? BigInt(600)} //if smthg fails, the pendign duration will be 10 minuts 
                  onClick={d => onTicketClick({ eventAddress: event.address, eventEndTime: event.endTime, location: event.eventMetadata?.location, ...d })} // make an object with the parameters that the ticketItem has provided and adding the eventAddress and calls 
                    //every ticket item has an arrow function, when the arrow funcion (callback) is called then activates the onTicketClick callback ant then MyTickets can fullfill the state, hen the state is filled then the modal is shown
                />
              ))}
            </div>
          )}
        </div>
      );
}

export default EventAccordion;