// SPDX-License-Identifier: MIT 

pragma solidity ^0.8.28;
import "node_modules/@openzeppelin/contracts/proxy/Clones.sol";
import "./EventTicketLogic.sol";
import "node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract EventTicketFactory is Ownable {

    //this will be the contract that will be cloned and all the clones will call this contract for logic
    address public immutable eventLogic; 

    address[] public stateEvents;

    event EventCreated( 
        address indexed eventAddress,
        address indexed creator,
        string name,
        uint256 ticketPrice,
        uint256 maxSupply,
        string eventURI,
        uint256 maxTicketsPerAddress,
        uint256 startPurchaseTime,
        uint256 eventEndTime
    );
    event logicContract (address indexed logicContract);
    constructor()  Ownable(msg.sender){
        
        EventTicketLogic logic = new EventTicketLogic();
        eventLogic = address(logic);
        emit logicContract(eventLogic);
    }



    //creates the proxy contract and initializes it
    function createEvent (
        string memory _name, 
        string memory _symbol,
        uint256 _ticketPrice,
        uint256 _maxSupply,
        string memory _eventURI,
        string memory _baseTokenURI,
        uint256 _maxTicketsPerAddress,
        uint256 _startPurchaseTime,
        uint256 _eventEndTime
    ) external onlyOwner returns (address){

        address clone = Clones.clone(eventLogic);

         EventTicketLogic.EventConfig memory config = EventTicketLogic.EventConfig({
            name: _name,
            symbol: _symbol,
            ticketPrice: _ticketPrice,
            maxSupply: _maxSupply,
            eventURI: _eventURI,
            baseTokenURI: _baseTokenURI,
            maxTicketsPerAddress: _maxTicketsPerAddress,
            startPurchaseTime: _startPurchaseTime,
            eventEndTime: _eventEndTime
        });

        EventTicketLogic(clone).initialize(
            config,
            msg.sender
        );

        stateEvents.push(clone);
        emit EventCreated(clone, msg.sender, _name, _ticketPrice, _maxSupply, _eventURI, _maxTicketsPerAddress, _startPurchaseTime, _eventEndTime);

        return clone;
    }

    function getEvents() external view returns (address[] memory) {
        return stateEvents;
    }
    

}
