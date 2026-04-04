'use client';

import { useState } from 'react';
import apiClient from '@/services/apiClient';

export default function AuthTestPage() {
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState('idle');

  const addLog = (msg: string) => {
    console.log(msg);
    setLog((prev) => [...prev, msg]);
  };

  const testLogin = async () => {
    setStatus('testing');
    setLog([]);
    addLog('Starting login test...');

    try {
      addLog('Clearing localStorage...');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      addLog('Calling API...');

      const response = await apiClient.post('/auth/login', {
        email: 'testuser@example.com',
        password: 'TestPass123@',
      });

      addLog(`API Response received: ${JSON.stringify(response.data, null, 2)}`);
      addLog(`Response.data: ${JSON.stringify(response.data, null, 2)}`);
      addLog(`Response.data.data: ${JSON.stringify(response.data.data, null, 2)}`);
      addLog(`Token from response: ${response.data.data?.access_token ? 'FOUND' : 'NOT FOUND'}`);
      addLog(`User from response: ${response.data.data?.user ? 'FOUND' : 'NOT FOUND'}`);

      if (response.data.data?.access_token) {
        addLog(`Storing token to localStorage...`);
        localStorage.setItem('token', response.data.data.access_token);
      }

      if (response.data.data?.user) {
        addLog(`Storing user to localStorage...`);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
      }

      addLog(`Token in localStorage: ${localStorage.getItem('token') ? 'YES' : 'NO'}`);
      addLog(`User in localStorage: ${localStorage.getItem('user') ? 'YES' : 'NO'}`);

      addLog('✅ Test complete!');
      setStatus('success');
    } catch (error) {
      addLog(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error) {
        addLog(`Stack: ${error.stack}`);
      }
      setStatus('error');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'mono', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Auth Flow Test</h1>
      <button
        onClick={testLogin}
        disabled={status === 'testing'}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: status === 'testing' ? 'not-allowed' : 'pointer',
          backgroundColor: status === 'testing' ? '#ccc' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        {status === 'testing' ? 'Testing...' : 'Run Login Test'}
      </button>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', minHeight: '200px' }}>
        <h3>Console Output:</h3>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '400px', overflow: 'auto' }}>
          {log.join('\n')}
        </pre>
      </div>
    </div>
  );
}
