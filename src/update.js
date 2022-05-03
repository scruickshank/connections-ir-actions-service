const compare = require('./compare');
const DocumentService = require('./documentService');

async function UpdateDocument(incoming,current) {
    const documentApi = new DocumentService();
    const prefix = getChannelType(current.metaData.source.socialOriginType);

    const documentId = `${prefix}_${current.systemData.policies.storage.privateTo}_${current.externalId}`;

    const json = compare.compareDocs(incoming,current);

    const document = await documentApi.updateDocument(documentId, json); 
}

function getChannelType(source) {
    switch (source) {
        case "facebook":
            return "fb";
        case "instagram":
            return "ig";

        case "linkedin":
            return "li"
        case "youtube":
            return "yt";
        
    }
}

module.exports = {
    UpdateDocument
};