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


exports.lambdaHandler = async (event, context) => {
    try {
      
      const requestArrays = []
      await googleTrends.dailyTrends({ geo: 'US' }, async(err, res) => {
        if(res) {
          let resp = JSON.parse(res)
          resp = resp.default.trendingSearchesDays[0].trendingSearches
          for (let i=0; i < resp.length; i++) {
            
            // console.log(resp[i].title.query)
            let temp = resp[i].title.query.replace(/\s+/g, '').toLowerCase()
            requestArrays.push(temp)
            
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
          const resps = await apiCall(query, requestArrays)
          
          console.log(client)

         
          
          
          
         
        }        
      })
    } catch (err) {
        console.log(err, 'sdjksjkdsk');
        return err;
    }
};

apiCall = async (query, requestArrays) => {
  try {
    const {data} = await axios.post(`https://api.thegraph.com/subgraphs/name/ensdomains/ens`, { query })
    const resultArray = data.data.registrations.map((item) => item.labelName)
    const checker = requestArrays.filter(x => !resultArray.includes(x)).map((item) => `('${item.replace("'", "''")}', ${true})`)
    const nonchecker = requestArrays.filter(x => resultArray.includes(x)).map((item) => `('${item.replace("'", "''")}', ${false})`)
    const client = new Client({
      user: "postgres",
      host: "localhost",
      password: "admin",
      database: 'postgres'
    });
    await client.connect();
    const queryText =
        `INSERT INTO ens_domains(domain, status) VALUES ${checker}  ON CONFLICT (domain) DO UPDATE SET status = excluded.status RETURNING (domain)`;
    const queryText1 =
    `INSERT INTO ens_domains(domain, status) VALUES ${nonchecker}  ON CONFLICT (domain) DO UPDATE SET status = excluded.status RETURNING (domain)`;
    console.log(queryText)
    const res = await client.query(queryText);
    const res1 = await client.query(queryText1);
    await client.end();
   return checker
  } catch(e) {
    console.log(e)
  }
}



exports.realtime = async (event, context) => {
  try {
    
    const requestArrays = []
    await googleTrends.realTimeTrends({ geo: 'US' }, async(err, res) => {
      
      if(res) {
        let resp = JSON.parse(res)
        resp = resp.storySummaries.trendingStories
        console.log(typeof res)

        for (let i=0; i < resp.length; i++) {
          
          // console.log(resp[i].title.query)
          // let temp = resp[i].title.query.replace(/\s+/g, '').toLowerCase()
          requestArrays.push(...resp[i].entityNames)
          
        }
        console.log(requestArrays)
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
        const resps = await apiCall(query, requestArrays)
        
        // console.log(client)

       
        
        
        
       
      }        
    })
  } catch (err) {
      console.log(err, 'sdjksjkdsk');
      return err;
  }
};

this.realtime()