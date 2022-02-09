module.exports = {
    apps: [{
  name: "seeker-service-cluster",
      script: "server.js",
      args: "start",
      instances : -1,
      exec_mode: "cluster",
    }]
  }