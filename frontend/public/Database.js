
import React, { useState, useEffect } from 'react';
import './Database.css';

const Database = ({ systemStatus }) => {
    const [databases] = useState([
        { id: 'indexeddb', name: 'IndexedDB', type: 'Document', status: 'online', size: '24.5 MB' },
        { id: 'sqljs', name: 'SQL.js', type: 'Relational', status: 'online', size: '12.3 MB' },
        { id: 'duckdb', name: 'DuckDB', type: 'Analytics', status: 'online', size: '8.7 MB' },
        { id: 'vectordb', name: 'Vector DB', type: 'Vector', status: 'online', size: '15.2 MB' },
        { id: 'cache', name: 'Cache', type: 'Memory', status: 'online', size: '4.1 MB' }
    ]);
    const [metrics, setMetrics] = useState({});
    const [contacts] = useState([
        { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'active' },
        { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'inactive' }
    ]);

    useEffect(() => {
        updateMetrics();
        const interval = setInterval(updateMetrics, 3000);
        return () => clearInterval(interval);
    }, []);

    const updateMetrics = () => {
        const newMetrics = {};
        databases.forEach(db => {
            newMetrics[db.id] = {
                queries: Math.floor(Math.random() * 1000),
                responseTime: 50 + Math.random() * 100,
                connections: Math.floor(Math.random() * 10),
                uptime: 95 + Math.random() * 5
            };
        });
        setMetrics(newMetrics);
    };

    return (
        <div className="database">
            <div className="db-header">
                <h1>Database Center</h1>
                <p className="db-subtitle">Multi-Database Management & CRM</p>
            </div>

            <div className="db-content">
                <div className="databases-overview">
                    <h3>Database Systems</h3>
                    <div className="databases-grid">
                        {databases.map(db => (
                            <div key={db.id} className={`db-card ${db.status}`}>
                                <div className="db-header-card">
                                    <h4>{db.name}</h4>
                                    <div className={`db-status ${db.status}`}></div>
                                </div>
                                <div className="db-info">
                                    <div className="db-type">{db.type}</div>
                                    <div className="db-size">{db.size}</div>
                                </div>
                                {metrics[db.id] && (
                                    <div className="db-metrics">
                                        <div className="metric">
                                            <span>Queries:</span>
                                            <span>{metrics[db.id].queries}</span>
                                        </div>
                                        <div className="metric">
                                            <span>Response:</span>
                                            <span>{metrics[db.id].responseTime.toFixed(0)}ms</span>
                                        </div>
                                        <div className="metric">
                                            <span>Uptime:</span>
                                            <span>{metrics[db.id].uptime.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="crm-section">
                    <h3>CRM Data</h3>
                    <div className="contacts-table">
                        <div className="table-header">
                            <div>Name</div>
                            <div>Email</div>
                            <div>Status</div>
                            <div>Actions</div>
                        </div>
                        {contacts.map(contact => (
                            <div key={contact.id} className="table-row">
                                <div>{contact.name}</div>
                                <div>{contact.email}</div>
                                <div className={`status ${contact.status}`}>{contact.status}</div>
                                <div>
                                    <button className="btn-small">Edit</button>
                                    <button className="btn-small">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Database;
