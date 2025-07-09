# Hackatime Monitor

its a little app for your phone that connects to your hackatime account. you put in your api key and then you can set alarms for how long you want to code. like if you want to code for 2 hours you set an alarm for 2h 0m and when hackatime says you've been coding for that long the app will alarm you and send you a notification to commit and post a devlog.

therer are 2 mode 
regular alarm : normal alarm which alarms you when you reach that time of coding
interval alarm : reduces complexity of adding multiple alarm instead lets imagaine today you are planning to work for 10 hours and commit and post a devlog for every 1 hour so you input interval : 1hr and number of commit and devlog you are planning which is 10 then the interval alarm auto add 10 alarms seperately 

## Why i made this webpage

* while working on the code i keep forgetting to commit my code and post my devlog in summer of making.
* this application remainds me to commit by alarming when i reach the desired hour.
* i made the interval feature becuase i was too lazy to set alarms for 1 hour, 2 hours, 3 hours etc.

## How i made it

* its a react native app using expo
* it just calls the hackatime api to get your coding stats for the day so no need change anything every day it auto resets. 
* all your alarms and the api key are saved on your phone using asyncstorage. so when you close the app everything is still there
* the coolest part is the background fetch.
* the alarm sound is just an mp3 from samsung that loops forever until you dismiss the alert. its very annoying on purpose

## Struggles and what i have learned

* getting the background task to work was a nightmare. it just wouldn't do anything for ages and its impossible to see what's going wrong
* at first the alarms would go off every 30 seconds once you passed your goal. i had to add a check to make sure it only triggers once per day. else its keep on alarming everytime the api fetches the hackatime data.
* i learned that keeping track of state is super important. like you have to remember if an alarm has already gone off today or not.
* i also learned that background tasks are powerful but really tricky to debug
* even teh "simple" features can be complicated to code right

## One Major Flaw

there is a error because of react native and expo i tried so many times to solve it but could not as this is my first application in react native the error is when the application moves to the background or when the screen is off the alarm is not ringing i dont know why so if you found any solution for this error plz dm me in slack asap or give a suggestion or alternative methood to solve this issue.

## usage of AI

* Error Lens : finds error in realtime
* Amazon Q Cli : real time code suggestion and explains error
* ChatGPT and Claude : solves bigger porblems