### redis

+ [redis.conf](http://download.redis.io/redis-stable/redis.conf)

+ 默认存储数据的文件：`dump.rdb`

+ [`docker run -p 6379:6379 --name redis -v /root/redis/redis.conf:/etc/redis/redis.conf  -v /root/redis/data:/data -d redis:latest redis-server /etc/redis/redis.conf --appendonly yes`](https://www.cnblogs.com/conswin/p/11547120.html)

  >redis-server /etc/redis/redis.conf：这个是关键配置，让redis不是无配置启动，而是按照这个redis.conf的配置启动
  >–appendonly yes：redis启动后数据持久化

---

### mongodb

+ 默认存储数据的文件：``

---