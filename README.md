# Palo Alto Networks: LPS Utility

### Overview
PANW's Original LPS Utility has been completely rewritten as a user-friendly [ElectronJS](https://electronjs.org) application to provide multi-platform support while simplifying the process of collecting and calculating disk space requirements for one or more firewalls or Panorama devices *simultaneously*. This process has always been a highly manual and single-threaded event, requiring time-consuming collection and post-processing to determine needs compared to data retention requirements. The New LPS Utility combines all of these once-tedious tasks into a simple automated process requiring little to no effort to get started right away.

### Parameters
| Parameter | Description | Default |
| --- | --- | --- |
| Number of Samples | Samples are taken every 10 seconds. This is the number of samples which should be taken in total. Make sure to collect enough data at peak times for best and most precise planning accuracy. | 360 samples (1 hour) |
| Connection Timeout | When establishing an SSH connection to a firewall or Panorama device, this is the maximum amount of time the application will wait for a handshake. | 60 seconds |
| Log Retention | How long do you need to keep your logs? This value is used to calculate total storage requirements based on your LPS. | 90 days |
| Log Size | What is the average size of the logs you anticipate to collect? | 360 bytes |
| Username | What is the SSH username of the devices you are connecting to? | admin |
| Password | What is the SSH password of the devices you are connecting to? | N/A |

For more information on properly tuning your sample parameters, see the following articles from the official PANW website:
* [Panorama Sizing and Design Guide](https://live.paloaltonetworks.com/t5/Management-Articles/Panorama-Sizing-and-Design-Guide/ta-p/72181)
* [Determine Panorama Log Storage Requirements](https://www.paloaltonetworks.com/documentation/71/panorama/panorama_adminguide/set-up-panorama/determine-panorama-log-storage-requirements)

### Installation
In order to install from prebuilt packages, follow the instructions for the operating system you are running:

#### Mac
1. Download the [application ZIP file](https://paloaltonetworks.box.com/s/py6cxghrwxgi1wzinorknc6z0sf3f4ar)
2. Double click the downloaded ZIP file to unzip it
3. Navigate to the "LPS Utility-darwin-x64" folder inside of the unzipped "Mac-LPS-Utility" folder
4. Right click the file called "LPS Utility.app" and select "Open" when prompted
5. If all goes well, you're done with the install! The next time you open the application, you will only need to double click the file.

#### Linux
1. Download the [application ZIP file](https://paloaltonetworks.app.box.com/s/0qtqudixkctynecb42uxggg4qheskvq9)
2. Open a terminal window and navigate to the folder containing the downloaded ZIP file
3. Execute the following commands to unzip and run the application:

```bash
unzip "Linux-LPS-Utility.zip"
cd "LPS Utility-linux-x64"
bash "LPS Utility"
```

4. If all goes well, you're done with the install! The next time you open the application, you will need to navigate to the same location in a terminal and run the following command:

```bash
bash "LPS Utility"
```