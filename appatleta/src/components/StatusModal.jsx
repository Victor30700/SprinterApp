import React from 'react';
import PropTypes from 'prop-types';
import '../styles/StatusModal.css';

const StatusModal = ({ isOpen, message, onRequestClose }) => {
  if (!isOpen) return null;

  return (
    <div className="status-modal-overlay">
      <div className="status-modal-content">
        <div className="status-loader"></div>
        <p>{message}</p>
      </div>
    </div>
  );
};

StatusModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  onRequestClose: PropTypes.func
};

export default StatusModal;