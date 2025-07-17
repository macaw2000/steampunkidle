import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginSuccess, loginFailure } from '../../store/slices/authSlice';
import { authService } from '../../services/authService';

const AuthCallback: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const result = await authService.handleOAuthCallback();
        dispatch(loginSuccess(result));
        navigate('/');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
        dispatch(loginFailure(errorMessage));
        navigate('/');
      }
    };

    handleCallback();
  }, [dispatch, navigate]);

  return (
    <div className="auth-callback">
      <div className="callback-container">
        <div className="loading-spinner">
          <div className="gear-spinner"></div>
        </div>
        <h2>Authenticating...</h2>
        <p>Please wait while we complete your login</p>
      </div>
    </div>
  );
};

export default AuthCallback;