CREATE TABLE IF NOT EXISTS ens_domains (
  id serial NOT NULL PRIMARY KEY,
  domain varchar(300),
);

INSERT INTO ens_domains (domain)
  VALUES ('Test');