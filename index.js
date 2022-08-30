const googleTrends = require('google-trends-api')
const { Client } = require("pg");
const axios = require('axios')

// const url = 'http://checkip.amazonaws.com/';
let response;

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */


exports.lambdaHandler = async (region) => {
    try {
      const requestArrays = []
      await googleTrends.dailyTrends({ geo: region }, async(err, res) => {
        if(res) {
          let resp = JSON.parse(res)
          resp = resp.default.trendingSearchesDays[0].trendingSearches
          for (let i=0; i < resp.length; i++) {
            let temp = resp[i].title.query.replace(/\s+/g, '').toLowerCase()
            if(!requestArrays.includes(temp)) {
              requestArrays.push(temp)
            }
            
          }
          const query = `
          query {
            registrations(where: { labelName_not: null, labelName_in: ["${requestArrays.join('","')}"] }) {
              expiryDate
              labelName,
              cost,
              registrationDate,
              
              domain {
                name
                labelName,
                isMigrated,
                subdomainCount,
                labelhash,
                owner
              }
            }
          }
          `
          await apiCall(query, requestArrays, region, 'dailytrend')         
        }        
      })
    } catch (err) {
        console.log(err, 'sdjksjkdsk');
        return err;
    }
};

apiCall = async (query, requestArrays, region, category) => {
  try {
    const {data} = await axios.post(`https://api.thegraph.com/subgraphs/name/ensdomains/ens`, { query })
    let resultArray = data.data.registrations.map((item) => item.labelName)
    resultArray = [...new Set(resultArray)];
    const checker = requestArrays.filter(x => !resultArray.includes(x)).map((item) => `('${item.replace("'", "''")}', true, '${region}', ${item.length}, '${category}')`)
    const nonchecker = requestArrays.filter(x => resultArray.includes(x)).map((item) => `('${item.replace("'", "''")}', false, '${region}', ${item.length}, '${category}')`)
    const client = new Client({
      user: "postgres",
      host: "localhost",
      password: "admin",
      database: 'postgres'
    });
    await client.connect();
    const queryText =
      `INSERT INTO ens_domains(domain, status, region, kw_length, category) VALUES ${checker}  ON CONFLICT (domain) DO UPDATE SET status = excluded.status RETURNING (domain)`;
    const queryText1 =
      `INSERT INTO ens_domains(domain, status, region, kw_length, category) VALUES ${nonchecker}  ON CONFLICT (domain) DO UPDATE SET status = excluded.status RETURNING (domain)`;
    console.log(queryText, queryText1)
    if(checker.length){
      const res = await client.query(queryText);
    }
    if(nonchecker) {
    const res1 = await client.query(queryText1);
    }
    await client.end();
   return checker
  } catch(e) {
    console.log(e)
  }
}



exports.realtime = async (region, category='all') => {
  try {
    
    await googleTrends.realTimeTrends({ category: category, geo: region }, async(err, res) => {
      if(res) {
        let resp = JSON.parse(res)
        resp = resp.storySummaries.trendingStories
        const requestArrays = []
        for (let i=0; i < resp.length; i++) {
          for (let j = 0; j<resp[i].entityNames.length; j++) {
            const name = resp[i].entityNames[j].replace(/\s+/g, '').toLowerCase()
            if(!requestArrays.includes(name)){
              requestArrays.push(name)
            }
          }
        }
        const query = `
        query {
          registrations(where: { labelName_not: null, labelName_in: ["${requestArrays.join('","')}"] }) {
            expiryDate
            labelName,
            cost,
            registrationDate,
            
            domain {
              name
              labelName,
              isMigrated,
              subdomainCount,
              labelhash,
              owner
            }
          }
        }
        `
        const resps = await apiCall(query, requestArrays, region, category)
      }        
    })
  } catch (err) {
      console.log(err, 'sdjksjkdsk');
      return err;
  }
};

this.lambdaHandler('US')
this.realtime('US')