/*
* Project: JScrapy
* Author: Aurora Wu
* Description: JavaScript爬虫实践
*/

var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var path = require('path');
// var ObjectId = require('mongodb').ObjectID;
var app = express();
var config = require('./config.json');
app.locals.title = 'JScrapy';
app.locals.email = 'wuxy91@gmail.com';

/*
* 保存抓取结果
*/
var saveArticles = function(db, data_arr) {
    data_arr.forEach(function(element){
      db.collection('articles').updateOne({'_id': element["_id"]}, element, {'upsert': true}, function(err, result) {
        assert.equal(err, null);
        console.log("保存成功");
      });
    });
};

/*
* 根据时间戳timestamp查询抓取结果
*/
var findArticles = function(db, source, callback) {
   db.collection('articles').find({sourceCode: source}).toArray(callback);
  //  db.collection('articles').find({sourceCode: source}).skip(start).limit(length).toArray(callback);
};

/*
* 爬取知乎日报的文章标题、URL
* 知乎日报官方API "http://news.at.zhihu.com/api/1.2/news/latest"
*/
var ZhihuDailyCrawler = function(callback) {
    //知乎日报不用登录...
    var articles = [];
    var url = config.url.ZhihuDaily;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var $ = cheerio.load(body);//使用cheerio处理HTML页面
            $('.box').each(function(i, elem) {
                var article = $(this).children().first();
                var title = article.text();
                var href = article.attr('href');
                var j_obj = {"title": title, "_id": url + href, "sourceCode": 'zhihuDaily'};
                articles.push(j_obj);
            });
            callback(articles);
        } else {//请求异常处理
            console.log("请求出错..." + error);
            callback(error);
        }
    })
};

/*
* 爬取IMDb.com上面Top Rated Movies的电影名称和URL
*/
var IMDbCrawler = function(callback) {
    //知乎日报不用登录...
    var articles = [];
    var url = config.url.IMDb;
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var $ = cheerio.load(body);//使用cheerio处理HTML页面
            $('td.titleColumn').each(function(i, elem) {
                var tag_a = $(this).children('a');
                var title = tag_a.text();
                var href = tag_a.attr('href');
                var j_obj = {"title": title, "_id": url + href, "sourceCode": 'imdb'};
                articles.push(j_obj);
            });
            callback(articles);
        } else {//请求异常处理
            console.log("请求出错..." + error);
            callback(error);
        }
    })
};

app.get('/scrape', function handler(req, res) {
  console.log('Request is coming...['+req.originalUrl+']');
  if(Object.keys(req.query).length == 0){//验证请求内容
    res.send('Request failed');
  } else{//合法请求返回查询结果
    if(req.query.website == 'zhihuDaily' || req.query.website == 'imdb'){//查询
      // console.log("正在查询...");
      res.sendFile(path.join(__dirname+'/html/show_result.html'));
    } else if(req.query.q == 'zhihuDaily' || req.query.q == 'imdb'){
      // console.log("来点数据...");
      start = req.query.start
      length = req.query.length
      pageNo = req.query.draw
      if(isNaN(start) || isNaN(length) || isNaN(pageNo)){
        // console.log("Oops...");
        res.json({draw: 1, recordsTotal: 0, recordsFiltered: 0, data: null})
      } else{
        start = parseInt(start)
        length = parseInt(length)
        pageNo = parseInt(pageNo)
      }
      MongoClient.connect(config['db']['url'], function(err, db) {
        assert.equal(null, err);
        findArticles(db, req.query.q, function(err, result){
          // console.log(result.slice(start, start+length));
          res.json({draw: pageNo, recordsTotal: result.length, recordsFiltered: result.length, data: result.slice(start, start+length)});
        });
      });
    } else{
      res.send('Request completed.');
    }
  }
});

app.listen(3000, function () {
  console.log('Your app is listening on port 3000!');
  console.log('待爬取的URL......');
  var urls = config['url'];
  if(Object.keys(urls).length > 0){
    for(key in urls){
      if(urls.hasOwnProperty(key)){
        console.log(urls[key]);
      }
    }
  }
  /*
  * 定时抓取
  */
  var CronJob = require('cron').CronJob;
  // var time2run = "00 30 1-23/2 * * *";
  var time2run = "00 29 * * * *";
  var job = new CronJob(time2run, function() {
    var timestamp = new Date() / 1000 | 0;
    console.log('定时任务启动...' + timestamp);
    //执行抓取任务并保存结果
    ZhihuDailyCrawler(function(data){
      console.log('ZhihuDailyCrawler：抓取成功');
      MongoClient.connect(config['db']['url'], function(err, db) {
        assert.equal(null, err);
        saveArticles(db, data);//保存
      });
    });
    IMDbCrawler(function(data){
      console.log('IMDbCrawler：抓取成功');
      MongoClient.connect(config['db']['url'], function(err, db) {
        assert.equal(null, err);
        saveArticles(db, data);//保存
      });
    });
  }, function () {//This function is executed when the job stops.
    var timestamp = new Date() / 1000 | 0;
    console.log('定时任务完成!' + timestamp);
  }, true);
  if(typeof db != 'undefined'){
    db.close();
  }
});
