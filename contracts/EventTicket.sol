// SPDX-License-Identifier: MIT 

pragma solidity ^0.8.28;

import "node_modules/erc721a/contracts/ERC721A.sol";
import "node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "node_modules/@openzeppelin/contracts/access/AccessControl.sol";
import "node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract EventTicket is ERC721A, Ownable, AccessControl, ReentrancyGuard{


    /************************************
    *         GLOBAL VARIABLES          *
    ************************************/

  
    enum TicketStatus { Active, Pending, Redeemed } //the states of a ticket
    
    struct Ticket {
        TicketStatus status; //the state of the ticket
        uint256 pendingSince; //to know if the pending state has finished (in case the usr has not redeemed the ticket)
        uint256 salePrice; // if a usr resell a ticket, the price will be here
        address seller;   //to remember the user who sells the ticket, bc when someone pays, the smart contract will make the transaction automatically
    } // we doesnt need to put the adress owner bc ERC721A controlls this part of the ERC721 standard 

    uint256 public ticketPrice;
    uint256 public maxSupply;
    string private baseTokenURI;
    uint256 public maxTicketsPerAddress; //Historically, the user cannot have had more than those tickets (even if they sold them and no longer own them)

    //time limit (in hours) for making transactions (mint, buy, resell...)
    bool public useTimeLimit;       //if it's true, the timestap will take effect
    uint256 public eventEndTime;    // indicates when the event finishes, from the deplyment of the contract until the event closes  
   

    uint256 public pendingDuration = 600; //you have 10 minutes to redeem the pending ticket
     mapping(address => uint256) public ticketsPurchased; // mapping of how many tickets a user have bought
 
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE"); // if allowSelfCheckIn is false, only addresses with this role can redeem

    mapping(uint256 => Ticket) public tickets; // all the minted tickets in one place
  
  
    


    /************************************
    *              EVENTS               *
    ************************************/
    event TicketsMinted(address indexed user, uint256 quantity);
    event RefundIssued(address indexed user, uint256 refund); //notify how much the contract has refound to the user
 

    /************************************
    *           CONSTRUCTOR             *
    ************************************/
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _ticketPrice,
        uint256 _maxSupply,
        string memory _baseTokenURI,
        uint256 _maxTicketsPerAddress,
        bool _useTimeLimit, 
        uint256 _eventEndTime 
    )
        ERC721A(_name, _symbol)
        Ownable(msg.sender)
        AccessControl()
    {
        ticketPrice = _ticketPrice;
        maxSupply = _maxSupply;
        baseTokenURI = _baseTokenURI;
        maxTicketsPerAddress = _maxTicketsPerAddress;

        useTimeLimit = _useTimeLimit;
        if (_useTimeLimit) {
            eventEndTime = block.timestamp + _eventEndTime * 3600;
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); //the deployer of the contract will be the admin
        _grantRole(VALIDATOR_ROLE, msg.sender); // create the new role VALIDATOR

    }


    /************************************
    *           USER FUNCTIONS          *
    ************************************/

    /****** allows to users create tickets (if the usr doens't owned more ticktes than the limit) ******/ 
    function mintTickets(uint256 quantity) external payable nonReentrant{

        if(useTimeLimit == true){//if the event don`t finished we can still minting tickets
            require(block.timestamp < eventEndTime, "the event has finished");
        }
        uint256 totalPrice = ticketPrice * quantity;
        require(msg.value >= totalPrice, "insuficient founds");//lets check if the user put in the transaction the amount to purchase the ticket
        require(totalSupply() + quantity <= maxSupply, "exceeded the maximum supply of tickets");//lets check if we dont exceed the max tickets supply 
        require(ticketsPurchased[msg.sender] + quantity <= maxTicketsPerAddress, "limit of owned tickeds reached");//the user can't own more than X ticktes (historically)
        
        //OK
        ticketsPurchased[msg.sender] += quantity;
        uint256 startTokenID = totalSupply(); //if the usr bought more than 1 ticket, we need too store all the infromation about 
        _safeMint(msg.sender, quantity);
        
        for(uint256 i =0; i < quantity; i++){ // put the default params of the ticket
            uint256 tokenID = startTokenID + i;
            tickets[tokenID] = Ticket({
                status: TicketStatus.Active,
                pendingSince: 0,
                salePrice: 0,
                seller: address(0)
            });
        }
        emit TicketsMinted(msg.sender, quantity);

        //return the remaining amount
        if(msg.value > totalPrice){
            uint256 refound = msg.value - totalPrice;
            payable(msg.sender).transfer(refound);
            emit RefundIssued(msg.sender, refound); // notify the user

        }
        
    }


    /************************************
    *           ONLY OWNER              *
    ************************************/

    /*     ROLE MANAGEMENT      */
    function addValidator(address newValidator) external onlyOwner {
        _grantRole(VALIDATOR_ROLE, newValidator);
    }

    function removeValidator(address validator) external onlyOwner{
        _revokeRole(VALIDATOR_ROLE, validator);
    }


    /************************************
    *             OVERRIDE              *
    ************************************/

    /****** overrides ERC721A, AccessControl to follow ERC165******/
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721A, AccessControl) returns (bool) {
        return ERC721A.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }


}


