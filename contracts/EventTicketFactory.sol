// SPDX-License-Identifier: MIT 

pragma solidity ^0.8.28;
import "./EventTicket.sol";

contract EventTicketFactory {

    address[] public events;
    address public immutable owner;

    constructor(){owner = msg.sender;}

    event EventCreated(
        address indexed eventAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 ticketPrice,
        uint256 maxSupply,
        string baseTokenURI,
        uint256 maxTicketsPerAddress,
        bool useTimeLimit,
        uint256 eventEndTime
    );

    function createEvent (
        string calldata _name, // calldata is ore gas effcient than memory on strings
        string calldata _symbol,
        uint256 _ticketPrice,
        uint256 _maxSupply,
        string calldata _baseTokenURI,
        uint256 _maxTicketsPerAddress,
        bool _useTimeLimit,
        uint256 _eventEndTime
    ) external returns (address eventAddr){
        require(msg.sender == owner, "only the owner can create events");
        EventTicket newEvent = new EventTicket(
            _name,
            _symbol,
            _ticketPrice,
            _maxSupply,
            _baseTokenURI,
            _maxTicketsPerAddress,
            _useTimeLimit,
            _eventEndTime
        );

        events.push(address(newEvent));

        emit EventCreated(
            address(newEvent),
            msg.sender,
            _name,
            _symbol,
            _ticketPrice,
            _maxSupply,
            _baseTokenURI,
            _maxTicketsPerAddress,
            _useTimeLimit,
            _eventEndTime
        );

        return address(newEvent);
    }

    function getEvents() external view returns (address[] memory) {
        return events;
    }

}
