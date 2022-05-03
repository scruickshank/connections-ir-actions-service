const axios = require('axios');
const logger = require('./logger');

class DocumentService {
    constructor() {
        
        this.axiosOptions = {
            method: 'GET',
            url: ``,
            headers: {
                'apikey': `${process.env.DOCUMENT_SERVICE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

    }

    async getDocument(docId) {

        this.axiosOptions.url = `${process.env.DOCUMENT_SERVICE_URL}/${docId}`;

        try {
            const response = await axios(this.axiosOptions);
            console.log(JSON.stringify(response.data));
            return response.data;

        } catch (e) {
            if (e.response) {
                logger.error(null, `There was an error calling: ${this.axiosOptions.url} for docId: ${docId} with error: ${JSON.stringify(e.response.data)}`);
            } else {
                logger.error(null, `There was an error calling: ${this.axiosOptions.url} for docId: ${docId} with error: ${e.message}`);
            }
            return null;
        }
        
    }

    async updateDocument(docId, jsonBody) {
        this.axiosOptions.url = `${process.env.DOCUMENT_SERVICE_URL}/${docId}`;
        this.axiosOptions.method = 'PATCH';

        try {
            this.axiosOptions.data = jsonBody;
            
            const response = await axios(this.axiosOptions);
            console.log(JSON.stringify(response.data));
            return response.data;

        } catch (e) {
            if (e.response) {
                logger.error(null, `There was an error calling: ${this.axiosOptions.url} for docId: ${docId} with error: ${JSON.stringify(e.response.data)}`);
            } else {
                logger.error(null, `There was an error calling: ${this.axiosOptions.url} for docId: ${docId} with error: ${e.message}`);
            }
            return null;
        }
    }
}

module.exports = DocumentService