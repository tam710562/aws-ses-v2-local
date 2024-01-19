module.exports = {
  apps: [{
    name: 'aws-ses-v2-local',
    script: './dist/cli.js',
    error_file: './err.log',
    out_file: './out.log',
    autorestart: true,
  }],
};
