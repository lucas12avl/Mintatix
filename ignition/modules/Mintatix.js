const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const {ethers} = require("hardhat");

module.exports = buildModule("Mintatix", (m) => {
  
  const factory = m.contract("EventTicketFactory"); //deploy the factory
  const eventLogicAddress = m.readEventArgument(factory, "logicContract", "logicContract", { id: "readLogicAddr" });
  const eventLogic = m.contractAt("EventTicketLogic", eventLogicAddress, { id: "logicAddr" }); //get the logic contract address



  const eventTickets = [];
  const numProxies = 4; //how many evenets we want to create
  
  // conecrEvent, f1Event, footballEvent, basketballEvent(try this one if finished),
  
  const EVENT_NAME = ["Strings of Light", "Grand Prix", "Electric Field", "Rising Hoops Championship"]
  const EVENT_SYMBOL = ["SOL", "GP", "EF", "RC"] //symbols for the events
  const EVENT_TICKET_PRICE = ethers.parseEther("0.0001") //price of the tickets
  const EVENT_MAX_SUPPLY = 4n //max supply of tickets for the events

  const EVENT_URI = ["ipfs://bafkreicjvqt7rb5o2pikboe36y77wkp5hlqdq52hklkdc3wrgwxouwcjba", "ipfs://bafkreieqipzkjqw2vskallbs2mlxax7v2uajtb3onh4bd7geq5mp2sje5i", "ipfs://bafkreif43u7uwba4fq6ymkdsi2z744h4anqmwau7bs7b4xzzqu34n2cbjy", "ipfs://bafkreighhg22ghjg5ce4wyzsncoqo2h4bxfsijibkun4yza643h6tab5d4"]
  const EVENT_BASE_TOKEN_URI = ["ipfs://bafkreifg2ie7adzzqoeybnxqfgeoi3jkikizrxzxkzwrzx7tc4gjsb6lfe", "ipfs://bafkreigndkkwdp2p2ijbhy2ciozhwog7fgdd4dnnpare4e3f5eof453gra", "ipfs://bafkreicqyuwj4dcpbxdv4w2u6ywdvj2kxyo4zvosqxnchbb2bd2i4q6tgm", "ipfs://bafkreidqujifdyppudhdvqw6mp2sql4aw7jnnhzo7xhjsczvjdb3i3rzhe"] //base token URI for the events
  const EVENT_MAX_TICKETS_PER_ADDRESS = 3n //max tickets per address for the events
  const START_PURCHASE_TIME = [0n , 0n, 1760950800n, 0n] //start purchase time for the events [now, now, 10:00:00 20/10/2025]
  const EVENT_END_TIME = [1763312400n, 1759600800n, 1763676000n, 	1807084800n] //event end time for the events
  

  
  for (let i = 0; i < numProxies; i++) { //create events


    // params: name, symbol, ticketPrice, maxSupply, eventURI, baseTokenURI, maxTicketsPerAddress, useTimeLimit, startPurchaseTime, eventEndTime
    const createEventTx = m.call(factory, "createEvent",[EVENT_NAME[i], EVENT_SYMBOL[i], EVENT_TICKET_PRICE, EVENT_MAX_SUPPLY, EVENT_URI[i], EVENT_BASE_TOKEN_URI[i], EVENT_MAX_TICKETS_PER_ADDRESS, START_PURCHASE_TIME[i], EVENT_END_TIME[i]], {id: "createEvent_" + EVENT_SYMBOL[i]});


    //in order to get the contrcat instance, we have to associate the address with an ABI 
    //the ABI provides the interface of the contract, so we can call the functions
    //this is bc minimal proxy contracts don't have a fixed ABI,  so we have to provide it. Here we are using the EventTicketLogic contract ABI
    const eventAddress = m.readEventArgument(createEventTx, "EventCreated", "eventAddress", {id: "readEvent_"+ EVENT_SYMBOL[i]})
    const eventTicket = m.contractAt("EventTicketLogic", eventAddress, {id: "proxy_"+ EVENT_SYMBOL[i]});
    eventTickets.push(eventTicket); 
  }
  
  return {factory, eventLogic, eventTickets}; //the factory and the event proxy contract

});
