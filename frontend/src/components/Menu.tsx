import { NavLink } from 'react-router-dom';
import { FaUser, FaTicketAlt, FaExchangeAlt } from 'react-icons/fa';
import logo from "../public/mintatix_ico_transparent.png";

import './css/Menu.css';

const Menu = () => {

    return (
        <nav className="side-menu">
          <NavLink to="/events" className="menu-logo">
            <img src={logo} alt="Logo" />
            <span className="logo-text">Mintatix</span>
          </NavLink>
          <ul className="menu-items">
            <li className="menu-item">
              <NavLink
                to="/events"
                className={({ isActive }) =>
                  isActive ? "menu-link active" : "menu-link"
                }
              >
                <FaTicketAlt className="menu-icon" />
                <span className="menu-label">Events</span>
              </NavLink>
            </li>
            <li className="menu-item">
              <NavLink
                to="/resales"
                className={({ isActive }) =>
                  isActive ? "menu-link active" : "menu-link"
                }
              >
                <FaExchangeAlt className="menu-icon" />
                <span className="menu-label">Resale</span>
              </NavLink>
            </li>
            <li className="menu-item">
              <NavLink
                to="/myTickets"
                className={({ isActive }) =>
                  isActive ? "menu-link active" : "menu-link"
                }
              >
                <FaUser className="menu-icon" />
                <span className="menu-label">My Tickets</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      );

}

export default Menu;