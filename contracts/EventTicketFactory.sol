// SPDX-License-Identifier: MIT 

pragma solidity ^0.8.28;
import "node_modules/@openzeppelin/contracts/proxy/Clones.sol";
import "./EventTicketLogic.sol";
import "node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract EventTicketFactory is Ownable {

    //this will be the contract that will be cloned and all the clones will call this contract for logic
    address public immutable eventLogic; 

    address[] public stateEvents;


    constructor()  Ownable(msg.sender){
        
        EventTicketLogic logic = new EventTicketLogic();
        eventLogic = address(logic);
    }

    event EventCreated( 
        address indexed eventAddress,
        address indexed creator,
        string name,
        uint256 ticketPrice,
        uint256 maxSupply,
        uint256 maxTicketsPerAddress,
        bool useTimeLimit,
        uint256 eventEndTime
    );

    //creates the proxy contract and initializes it
    function createEvent (
        string memory _name, 
        string memory _symbol,
        uint256 _ticketPrice,
        uint256 _maxSupply,
        string memory _baseTokenURI,
        uint256 _maxTicketsPerAddress,
        bool _useTimeLimit,
        uint256 _eventEndTime
    ) external onlyOwner returns (address){

        address clone = Clones.clone(eventLogic);
        EventTicketLogic(clone).initialize(
            _name,
            _symbol,
            _ticketPrice,
            _maxSupply,
            _baseTokenURI,
            _maxTicketsPerAddress,
            _useTimeLimit,
            _eventEndTime,
            msg.sender
        );

        stateEvents.push(clone);

        emit EventCreated(clone,msg.sender, _name, _ticketPrice, _maxSupply, _maxTicketsPerAddress, _useTimeLimit, _eventEndTime);

        return clone;
    }

    function getEvents() external view returns (address[] memory) {
        return stateEvents;
    }

}
