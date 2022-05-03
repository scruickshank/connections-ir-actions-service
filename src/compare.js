const incoming = require('../tests/sns.json');
const redisVersion = require('../tests/fakeRedis.json')

function compareDocs(incoming,current) {
    let updateJson = [];

    const body = compareBody(incoming,current);

    const appTags = compareApplicationTags(incoming,current);

    const adCampaign = compareAdCompaign(incoming,current);

    if (body) {
        updateJson.push(body);
    }

    if (appTags) {
        updateJson.push(appTags);
    }

    if (adCampaign) {
        updateJson.push(adCampaign);
    }

    return updateJson;
}

function compareBody(incoming, redisVersion) {
    if (incoming.body.content.text !== redisVersion.body.content.text) {
        return {
                "operation": "setValue",
                "fieldPath": "body.content",
                "value": `${incoming.body.content}`    
            }
    }
}

function compareApplicationTags(incoming, redisVersion) {
    // "applicationTags":[
    //     "connectionsCredential=14888",
    //     "isHidden=false",
    //     "userLikes=false"
    //  ],
    let appTags = [];
    let bChanges = false;

    const connectionsCredential = redisVersion.metaData.applicationTags.filter(function(tag) {
        return tag && tag.slice(0,8) === 'connecti';
    });
    appTags = appTags.concat(connectionsCredential);
    const pollCycleId = redisVersion.metaData.applicationTags.filter(function(tag) {
        return tag && tag.slice(0,8) === 'pollCycl';
    });
    appTags = appTags.concat(pollCycleId);

    const isHiddenRedisVersion = redisVersion.metaData.applicationTags.filter(function(tag) {
        return tag && tag.slice(0,8) === 'isHidden';
    });

    const isHiddenIncoming = incoming.metaData.applicationTags.filter(function(tag) {
        return tag && tag.slice(0,8) === 'isHidden';
    });

    if (isHiddenIncoming[0] !== isHiddenRedisVersion[0]) {
        bChanges = true;

        appTags = appTags.concat(isHiddenIncoming);
        // this triggers a sequence of events that will need to be handled.
        // if this is an 'og' document, we need to set all the children (comments and replies) isHidden to this isHidden value
        // if this is a 'qt', any replies will need to set to this isHidden value
        // bulkUpdate(parentId, isHidden);
    } else {
        appTags = appTags.concat(isHiddenRedisVersion);
    }

    const userLikesIncoming = incoming.metaData.applicationTags.filter(function(tag) {
        return tag && tag.slice(0,8) === 'userLike';
    });

    const userLikesRedis = redisVersion.metaData.applicationTags.filter(function(tag) {
        return tag && tag.slice(0,8) === 'userLike';
    });

    if (userLikesIncoming[0] !== userLikesRedis[0]) {
        bChanges = true;
        appTags = appTags.concat(userLikesIncoming);
    } else {
        appTags = appTags.concat(userLikesRedis);
    }

    if (bChanges) {
        return {
            "operation": "setValue",
            "fieldPath": "metaData.applicationTags",
            "value": appTags  
        }
    }
    
}

function compareAdCompaign(incoming,redisVersion) {
    if (incoming.metaData.adCampaign && !redisVersion.metaData.adCampaign.campaignId) {
        return {
            "operation": "setValue",
            "fieldPath": "metaData.adCampaign",
            "value": incoming.metaData.adCampaign
        }
    } else if (redisVersion.metaData.adCampaign && !incoming.metaData.adCampaign.campaignId){
        return {
            "operation": "setValue",
            "fieldPath": "metaData.adCampaign",
            "value": {}   
        }
    } else {
        console.log('nothing')
    }
}

compareDocs(incoming, redisVersion);

module.exports = {
    compareDocs
}