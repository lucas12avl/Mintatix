import { useDisconnect } from 'wagmi';

import './css/Disconnect.css';

const Disconnect = ({isOpen, onClose}: {isOpen: boolean, onClose: () => any}) => {

    const { disconnect } = useDisconnect(); //wagmi hooks that returns the disconnect function
    if(!isOpen) return null; //if the disconnect component is not open, then will not show anything

    const handleDisconnect = () => {
        disconnect(); // callthe disconnect function from wagmi
        onClose(); //call the onClick callback that cloes this component
    }

    const handleContentClick = (e: React.MouseEvent) => {
        e.stopPropagation(); //ensure that the click event doesn't propagate to the parent element, which would close the component
    }

    return (
        // El overlay llama a onClose cuando se hace clic fuera del contenido
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content disconnect-modal-content" onClick={handleContentClick}>
            <h3>Disconnect the wallet?</h3>
            <div className="disconnect-modal-buttons">
              <button className="button disconnect-button" onClick={handleDisconnect}>
                Disconnect
              </button>
              <button className="button back-button" onClick={onClose}>
                Back
              </button>
            </div>
          </div>
        </div>
      );
}

export default Disconnect;