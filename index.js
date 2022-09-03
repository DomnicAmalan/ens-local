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
      const mainKeyword = []
      await googleTrends.dailyTrends({ geo: region }, async(err, res) => {
        if(res) {
          let resp = JSON.parse(res)
          resp = resp.default.trendingSearchesDays
          for (let i=0; i < resp.length; i++) {
            for (let j=0; j < resp[i].trendingSearches.length; j ++) {
              let temp = resp[i].trendingSearches[j].title.query.replace(/\s+/g, '').toLowerCase()
              if(!requestArrays.includes(temp)) {
                requestArrays.push(temp)
                mainKeyword.push(resp[i].trendingSearches[j].title.query)
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
          await apiCall(query, requestArrays, region, 'all', 'dailytrend', mainKeyword)         
        }        
      })
    } catch (err) {
        console.log(err, 'sdjksjkdsk');
        return err;
    }
};

apiCall = async (query, requestArrays, region, category, bucket, mainkeyword) => {
  try {
    const {data} = await axios.post(`https://api.thegraph.com/subgraphs/name/ensdomains/ens`, { query })
    let checker = []
    let nonchecker = []
    const presentItems = data.data.registrations.map((item, idx) => item.labelName)
    for (let index = 0; index < requestArrays.length; index++) {
      const element = requestArrays[index];
      if(presentItems.includes(element)) {
        const matched = mainkeyword[requestArrays.indexOf(element)]
        if(matched) {
          checker.push(`('${element.replace("'", "''")}', true, '${region}', ${matched.length}, '${category}', '${bucket}', '${matched.replace("'", "''")}')`)
        }
       
      } else {
        const matched = mainkeyword[requestArrays.indexOf(element)]
        nonchecker.push(`('${element.replace("'", "''")}', true, '${region}', ${matched.length}, '${category}', '${bucket}', '${matched.replace("'", "''")}')`)
      }

    }
    const client = new Client({
      user: "postgres",
      host: "localhost",
      password: "admin",
      database: 'postgres'
    });
    await client.connect();
    const queryText =
      `INSERT INTO 
        ens_domains(domain, status, region, kw_length, category, input_bucket, original_keyword) 
        VALUES ${checker}  
        ON CONFLICT (domain) 
        DO UPDATE SET 
          status = excluded.status,
          category = excluded.category,
          input_bucket = excluded.input_bucket,
          region = excluded.region,
          orginal_keyword = excluded.orginal_keyword, 
          kw_length = excluded.kw_length
        RETURNING (domain)`;
    const queryText1 =
      `INSERT INTO 
        ens_domains(domain, status, region, kw_length, category, input_bucket, original_keyword) 
        VALUES ${nonchecker}  
        ON CONFLICT (domain) 
        DO UPDATE SET 
          status = excluded.status,
          category = excluded.category,
          input_bucket = excluded.input_bucket,
          region = excluded.region,
          orginal_keyword = excluded.orginal_keyword,
          kw_length = excluded.kw_length
        RETURNING (domain)`;
    if(checker.length){
      const res = await client.query(queryText);
    }
    if(nonchecker) {
    const res1 = await client.query(queryText1);
    }
    await client.end();
   return "checker"
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
        const mainKeyWord = []
        for (let i=0; i < resp.length; i++) {
          for (let j = 0; j<resp[i].entityNames.length; j++) {
            const name = resp[i].entityNames[j].replace(/\s+/g, '').toLowerCase()
            if(!requestArrays.includes(name)){
              requestArrays.push(name)
              mainKeyWord.push(resp[i].entityNames[j])
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
        
        const resps = await apiCall(query, requestArrays, region, category, 'realtime', mainKeyWord)
      }        
    })
  } catch (err) {
      console.log(err, 'sdjksjkdsk');
      return err;
  }
};

exports.checkExisting = async () => {
  try {
    const client = new Client({
      user: "postgres",
      host: "localhost",
      password: "admin",
      database: 'postgres'
    });
    await client.connect();
    const queryText =
    `SELECT domain from ens_domains`;
    const res = await client.query(queryText);

    let requestArrays = []
    for (let i=0; i < res.rows.length; i++) {
      const name = res.rows[i].domain.replace(/\s+/g, '').toLowerCase()
      if(!requestArrays.includes(name)){
        requestArrays.push(name)
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
        const {data} = await axios.post(`https://api.thegraph.com/subgraphs/name/ensdomains/ens`, { query })
        // const queryText1 = `UPDATE ens_domains SET `
        // const resps = await apiCall(query, requestArrays, region, category, 'realtime')
  } catch(e) {
    console.log(e, 'sdjksjkdsk');
    return e;
  } 
}

this.lambdaHandler('US')
this.realtime('US')
this.realtime('US','b')
this.realtime('US','e')
this.realtime('US','m')
this.realtime('US','t')
this.realtime('US','s')
this.realtime('US','h')
// this.checkExisting()