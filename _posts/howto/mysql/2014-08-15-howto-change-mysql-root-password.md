---
layout: post
title: "Change User Password"
abstrat: "How do I change MySQL root password under unix-like os-es over the terminate session?
        Here is two method to change the password"
tagline: "HOWTO - MySQL"
tags : [howto, mysql]
---
{% include JB/setup %}

Settingng up MySQL password is one of the essential tasks. By default, root user is MySQL admin account user. Please note that the Linux or UNIX root account for your operating system and MySQL root user accounts are different. They are separate, and nothing to do with each other. Sometime you may remove Mysql root account and setup admin user as super user for security purpose.

# Method #1:  Use mysqladmin command to change root password

## Setting a user password when non password for root
If you have never set a root password for MySQL server, the server does not require a password at all for connecting as root. To setup root password for first time, use mysqladmin command at shell prompt as follows:

    ```
    mysqladmin -u root password NEWPASSWORD
    ```

However, if you want to change (or update) a root password, then you need to use the following command:

    mysqladmin -u root -p'oldpassword' password newpass

## Verify that the new password is working or not

Use the following mysql command:

    mysql -u root -p'mypassword' [db-name-goes-here]

Or without login to mysql client tool:
    
    mysql -u root -p'mypassword' -e "show databases;" 

This is useful for normal users too:
    
    mysqladmin -u username -p'old-password' password new-password

# Method #2: Login with old user and password using mysql client command

MySQL stores username and passwords in user table inside MySQL database. You can directly update or change the password using the following method for user called `username`:

Login to mysql:

    mysql -uusername -p

Use mysql database in mysql prompt:

    mysql> use mysql;

Change password for the user:

    mysql> update user set password=PASSWORD("NEWPASSWORD") where User='username';

Finally, refresh the user privileges:

    mysql> flush privileges;
    mysql> quit;

# Reference

1. [Nix Craft. MySQL Change root Password.](http://www.cyberciti.biz/faq/mysql-change-root-password/);

