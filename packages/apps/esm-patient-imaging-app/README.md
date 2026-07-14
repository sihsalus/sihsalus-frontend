
OpenMRS Orthanc
===============
To add the imaging capabilities to OpenMRS. We have developed an integration with the Picture Archiving and Communication System (PACS) [Orthanc](https://orthanc.uclouvain.be/). The OpenMRS ``Imaging`` module introduces a solution for managing medical imaging workflows, including DICOM uploads, visualisation, and worklist coordination, through both front-end and back-end components. By connecting OpenMRS with Orthanc, this module provides imaging support without the need of a RIS, making it suitable for smaller clinics and facilities.

### Videos
- OpenMRS 2.x: [Watch the video](https://youtu.be/no3WNaq4Q_M)
- OpenMRS 3.x: [Watch the video](https://youtu.be/Z4MRPmkwHms)


# Imaging for OpenMRS 2.x

The Integration `Imaging` Module was initially developed for OpenMRS 2.x, which is the most widely used version of OpenMRS. The module comprises three main components:

- The **frontend** app in the `openmrs-orthanc-core/omod` folder provides a UI for managing imaging requests and  DICOM image data, including visualization.
- The **backend** module in the `openmrs-orthanc-core` folder connects OpenMRS with one or more **Orthanc DICOM servers**, handling DICOM uploads, image metadata, and imaging procedure worklists.
- The **Orthanc plugin** in the `openmrs-orthanc-core/orthanc-plugin` folder translates worklist queries and responses between OpenMRS and the modality software.

## Architecture

### Data model

![Data model](figures/imaging_datamodel.png)

The data model diagram shows the datamodel used by our integration module inside OpenMRS. The OpenMRS administrator first configures one or more connections to Orthanc servers. This information, represented by OrthancConfiguration objects, are stored in OpenMRS.

Instances of the classes DicomStudy, DicomSeries, and DicomInstances contain the metadata of the DICOM studies, series, and instances as retrieved from the Orthanc servers through the Orthanc API. Various methods are implemented to query, retrieve, and manage (e.g., delete) them through the OpenMRS backend services exposed to the OpenMRS frontend. An important step of a typical workflow is to assign a newly retrieved DICOM study to a patient.

When synchronizing OpenMRS with the Orthanc servers, the DICOM study metadata is fetched from the servers and stored in OpenMRS such that the list of studies can be quickly shown whenever a health care expert opens a patient record in OpenMRS. However, the series and instance data is retrieved from the Orthanc servers only on demand, i.e., when the expert decides to see the content of a study.

Experts can request imaging procedures for a patient, represented in the model by instances of RequestProcedure. A requested procedure consists of multiple procedure steps for specific modalities. When a procedure step has been performed, its status changes. Correspondingly, the status of the procedure changes if all its procedures have been performed. The procedure is then associated with the result, a new DICOM study containing the requested imaging data.

### Image data management
This is the heart of the Orthanc integration, allowing browsing and viewing of patient images through DICOM viewers available within Orthanc.
The module retrieves the metadata of image studies stored on Orthan servers. A mapping function helps associating OpenMRS patient records with their
corresponding studies. In addition, image data can be uploaded directly from the OpenMRS web client to Orthanc servers.

#### Features

- **Upload, view, assign and delete medical images**:
This is the heart of the Orthanc integration, allowing browsing and viewing of patient images through DICOM viewers available within Orthanc.
The module retrieves the metadata of image studies stored on Orthan servers. A mapping function helps associating OpenMRS patient records with their
corresponding studies. In addition, image data can be uploaded directly from the OpenMRS web client to Orthanc servers.

- **Automatic status update on DICOM study upload**:
The Orthanc server will notify the OpenMRS server and the status of the procedure step will change in the frontend.


### Orthanc-Supported DICOM Worklist
In the context of radiology, a worklist is a list of imaging studies or tasks that a radiologist needs to execute, review, or analyze.
These tasks are typically retrieved from a radiology information system (RIS), a specialized database that manages patient and imaging information.
However, in situations where an RIS system is not available or feasible (such as for smaller healthcare facilities, clinics, or specific locations),
a simple radiology worklist can be sufficient.

The Orthanc servers also act as DICOM worklist servers. Imaging procedure requests created in the frontend can be queried by modalities or the 
radiology department from the Orthanc servers. When a DICOM study matching the `PerformedProcedureStepID` tag of a worklist procedure step is uploaded
to an Orthanc server, the Orthanc server will notify the OpenMRS server and the status of the procedure step will change in the frontend.

We have developed an Orthanc plugin that provides full support for the worklist feature. The plugin facilitates two-way communication for DICOM worklist management and ensures that image request status updates are synchronised with OpenMRS. Communication with OpenMRS is handled via HTTP Basic Authentication, with login credentials configured directly within the Orthanc settings. This ensures that the worklist status in OpenMRS always reflects the current state of the imaging data.

#### Features

- **Create and manage imaging procedure requests**:
In the context of radiology, a worklist is a list of imaging studies or tasks that a radiologist needs to execute, review, or analyze.
These tasks are typically retrieved from a radiology information system (RIS), a specialized database that manages patient and imaging information.
However, in situations where an RIS system is not available or feasible (such as for smaller healthcare facilities, clinics, or specific locations), a simple radiology worklist can be sufficient.

- **Monitor status of DICOM  worklist tasks via Orthanc plugin**:
The Orthanc servers also act as DICOM worklist servers. Imaging procedure requests created in the frontend can be queried by modalities or the 
radiology department from the Orthanc servers. When a DICOM study matching the `PerformedProcedureStepID` tag of a worklist procedure step is uploaded
to an Orthanc server. the Orthanc server will notify the OpenMRS server and the status of the procedure step will change in the frontend.


DICOM Worklist Query Processing `OnWorkList`: This function converts DICOM C-FIND worklist requests from a radiology workstation or a modality into JSON format and forwards them to the OpenMRS service. The response, which contains patient and procedure data, is matched to the request and sent back to the querying device that made the query.

Image Request Status Update `OnChange`: This function uses the OnChange callback function to monitor the status of an Orthanc study. Once the study status has stabilised, the plug-in extracts the StudyInstanceUID and PerformedProcedureStepID and sends them to OpenMRS to update the status of the corresponding image request.

Configuration Management `getConfigItem`: This function retrieves configuration parameters (such as endpoints and credentials) from the Orthanc settings.

![worklist workflow](figures/worklist_workflow.png)

This above diagram illustrates how worklists work:
1. A practitioner creates a request for an imaging procedure in the OpenMRS web GUI. The procedure can consist of multiple steps. The request is stored in OpenMRS' database.
1. A radiologist queries the list of requested procedures by sending a C-FIND query from their modality application to the Orthanc server. 
1. On the Orthanc server, the plugin translates and forwards the request to the backend module on the OpenMRS server. 
1. OpenMRS processes the request and returns the list of requested procedures in JSON format. 
1. The Orthanc plugin generates a response as a DICOM Modality Worklist and sends it to the modality application. 
1. When the radiologist has performed the requested procedure (or part of it), a new DICOM study is created and uploaded to the Orthanc server. 
1. The Orthanc plugin notifies OpenMRS to update the status of the requested procedure. The procedure step corresponding to the uploaded DICOM study is marked as `completed`.

If you want to query the worklist manually, you can use the [`findscu`  command line tool](https://support.dcmtk.org/docs/findscu.html) where `XXXX` is the name or IP address of the Orthanc server: 

```bash
findscu -v -W -k "ScheduledProcedureStepSequence[0].Modality=CT" XXXX 4242
```

## Preparing

- **OpenMRS backend**
    
  You need an OpenMRS core backend server. Follow this link for more information: https://openmrs.atlassian.net/wiki/spaces/docs/pages/25476136/OpenMRS+SDK#Setup.

  The current backend module implementation supports OpenMRS 2.x and 3.x. For this reason, it has the following dependencies on OpenMRS 2 modules, which you need on your backend. These modules can be download from the folder `openmrs-orthanc-docker/modules` folder: 
    - appframework-2.18.0.omod
    - appui-1.18.0.omod
    - uiframework-4.0.0.omod
    - uicommons-2.26.0.omod
    - webservices.rest-2.50.0.omod

- **Orthanc servers**
  - Install Orthanc: https://orthanc.uclouvain.be/
  - Verify that you have the required plugins installed:
      - dicom-web
      - ohif
      - orthanc-explorer-2
      - python
      - stone-webviewer 
      - web-viewer 
      - worklist
      - wsi
      
![Orthanc plugins](figures/orthanc_installed_plugins.png)

### Configure your Orthanc servers
The imaging backend module provides an REST API service that the Orthanc servers need to contact to query and update the worklist. 
Add the following lines to the configuration file of the Orthanc servers (typically the file `/etc/orthanc/orthanc.json`):

```bash
"ImagingWorklistURL": "http://OPENMRSHOST:OPENMRSPORT/openmrs/ws/rest/v1/worklist/requests",   
"ImagingUpdateRequestStatus": "http://OPENMRSHOST:OPENMRSPORT/openmrs/ws/rest/v1/worklist/updaterequeststatus",`
"ImagingWorklistUsername" : "OPENMRSHOSTUSER",`  
"ImagingWorklistPassword" : "OPENMRSHOSTPASSWORD"`
```

Replace OPENMRSHOST and OPENMRSPORT by the address and port of your OpenMRS backend server, and OPENMRSHOSTUSER and OPENMRSHOSTPASSWORD 
by the name and password of an user account on the OpenMRS server that you have created for the Orthanc servers.

### Install the worklist plugin on the Orthanc servers:
The Orthanc servers act as worklist servers for the modalities. Our python plugin for Orthanc implements the needed functionality. Download 
the python script from the folder `openmrs-orthanc-backend/orthanc-plugin/orthancWorklist.py` and place it in a directory that is accessible by the Orthanc servers, for example in `/etc/orthanc`. Then add the following line to the python plugin configuration file 
of Orthanc (typically the file `python.json` in `/etc/orthanc`):

```bash
"PythonScript": "/etc/orthanc/orthancWorklist.py",
```
Then restart the Orthanc server:

```bash
sudo systemctl restart orthanc
```

## Deployment

Download our imaging backend OMOD module from https://github.com/sadrezhao/openmrs-module-imaging/releases, copy it to the module directory of your OpenMRS backend server, and start the server or OpenMRS is up and running, you can upload the new module `imaging-1.0.5-SNAPSHOT.omod` using the 'Add or Upgrade Module' option in `Manage Modules` of the `Administration` of OpenMRS. Please note that the upload may take some time. If deployed successfully, it should appear in the list of loaded modules on your server:

![The imaging module](figures/imagingModule.png)

Deploy OpenMRS Imaging module from it's directory by cloning the repository, navigating to the directory and running the following run command. This will automatically
deploy the module before the server is started. To streamline the process, add the following run configuration to your IDE to efficiently build, deploy and run the project.:

```bash
mvn clean install openmrs-sdk:run -DserverId=myserver
```
### Upload the imaging module
Once the application is running, you will need to upload the imaging module from the `openmrs-orthanc-docker/modules` folder within this project:
- imaging-1.1.5-SNAPSHOT.omod


## Configure the connection to the Orthanc servers
You must provide connection settings (IP address, username, etc.) in order to allow OpenMRS to reach the Orthanc server(s). If the imaging module has been correctly deployed, you can access the connection settings on the administration page of your OpenMRS server:

![Orthanc server configuration](figures/orthancConfiguration.png)


## Testing the module for OpenMRS 2.x
- Run unit and integration tests:
```bash
mvn test
```
- Run test result
```bash
mvn clean install 
mvn clean test jacoco:report
```
- Test reports are stored in the folder `openmrs-orthanc-backend/omod/target/site/jacoco/api` and `openmrs-orthanc-backend/omod/target/site/jacoco/omod`.

- Testing the worklist
First, create some new imaging requests in the front end. The DCMTK findscu tool from https://support.dcmtk.org/docs/findscu.html allows to query the resulting 
DICOM worklists from the Orthanc server (replace 127.0.0.1 by the IP address of the Orthanc server):

```bash
# Query by modality 
findscu -v -W -k "ScheduledProcedureStepSequence[0].Modality=CT" 127.0.0.1 4242

# Query by patient name
findscu -v -W -k "PatientName=XXXX" 127.0.0.1 4242

# Query by patient data
findscu -v -W -k "PatientID=PatientUuid" 127.0.0.1 4242

# Query by requested procedure description
findscu -v -W -k "ScheduledProcedureStepSequence[0].RequestedProcedureDescription=xxx" 127.0.0.1 4242 
```

If you want to generate a `.wl` file, uncomment the following lines from the python plugin:

``` bash
# This code only for test:`
  # Save the DICOM buffer to a file`
  # with open("/tmp/worklist_test.wl", 'wb') as f:
  # f.write(responseDicom)`
```

## Repo links
- Backend and GUI 2.x: https://github.com/sadrezhao/openmrs-module-imaging
- Orthanc Worklist Plugin: https://github.com/sadrezhao/openmrs-module-imaging/blob/main/orthanc-plugin/orthancWorklist.py


# Imaging for OpenMRS 3.x
OpenMRS 3.x, the next generation of electronic medical record (EMR) system and incorporates modern technologies and user interface design. The new OpenMRS front end uses these modern technologies to enable users and developers worldwide to share front-end functionality, reduce duplication of effort and enhance the user experience. We have developed an imaging module — a micro-frontend user interface powered by the core OpenMRS backend - which is focused on simplifying the management of imaging data. The first version is now available at https://www.npmjs.com/package/@zhaosadre/esm-patient-imaging-app.

- The **Micro-frontend** app in the `openmrs-orthanc-frontend` folder provides a modern UI for managing imaging requests and  DICOM image data, including visualization.
- The **backend** module in the `openmrs-orthanc-core` folder connects OpenMRS 2.x as backend with one or more **Orthanc DICOM servers**, handling DICOM uploads, image metadata, and imaging procedure worklists.
- The **Orthanc plugin** in the `openmrs-orthanc-core/orthanc-plugin` translates worklist queries and responses between OpenMRS and the modality software.

## Installation

> **Note:** First follow the **[Preparing](#preparing)** section and **[Deployment](#Deployment)**

We will not describe here how to create a new OpenMRS distribution for production deployment. For quickly testing the frontend, there are two ways:

### Running the frontend app locally:
Go to the folder `openmrs-orthanc/openmrs-orthanc-frontend`
  ```bash
  yarn install

  # Start frontend
  npm start -- --backend http://OPENMRSHOST:OPENMRSPORT/
  ```
  Replace `OPENMRSHOST` and `OPENMRSPORT` with your backend address and port.


### Deploying the frontend app in an existing OpenMRS 3.x server for testing:

1. In your cloned project folder, open the package.json file and update the name field to:
    ```json
    "name": "@openmrs/esm-patient-imaging-app"
    ```
1. Edit the file `/src/index.ts` and replace the module name constant with:
    ```typescript
    const moduleName = '@openmrs/esm-patient-imaging-app'
    ```
1. Reinstall dependencies:
    ```bash
    yarn install
    ```
1. Build the new version of the module:
    ```bash
    npm run build
    ```
1. Copy the directory `dist` from the package 'openmrs-esm-patient-imaging-app' to the directory `your-openmrs3-server/frontend/`, then rename the `dist` folder to `openmrs-esm-patient-imaging-app-1.0.1-pre.1`
1. Add the following entry to the file `your-openmrs3-server/frontend/importmap.json`:
    ```bash
    @openmrs/esm-patient-imaging-app":"./openmrs-esm-patient-imaging-app-1.0.1-pre.1/openmrs-esm-patient-imaging-app.js
    ```
1. Create a new top-level key named `@openmrs/esm-patient-imaging-app` in the file `your-openmrs3-server/frontend/routes.registry.json`. For the value of the key, copy the entire content of the file `route.json` that is located in `openmrs-esm-patient-imaging-app-1.0.1-pre.1`

1. Restart the OpenMRS server


## Testing the module for OpenMRS 3.x

### Run unit and integration tests:
```bash
npm run test
```

### Run end-to-end (E2E) tests:

Before running end-to-end (E2E) tests, ensure that you have the following set up:
  - **Orthanc Server** installed and running — ensure it contains **no image data**.
  - **Imaging` backend server** is started.
  - **OpenMRS3.x frontend** is running:  

```bash
npm start -- --backend http://localhost:YOUR-BACKEND-PORT/
```

> **Note** Orthanc configuration is correctly added to your environment.

This project uses the shared root Playwright runner. The package-level `yarn test-e2e` command delegates to the patient imaging suite config at `e2e/patient-imaging/playwright.config.ts`.

### Run a single **E2E(end-to-end)** suite

```bash
export E2E_BASE_URL=http://localhost:YOUR-BACKEND-PORT/openmrs
yarn test-e2e -- --grep "imaging detailed summary"
```

### Run **E2E(end-to-end)** test suites

```bash
export E2E_BASE_URL=http://localhost:YOUR-BACKEND-PORT/openmrs
yarn test-e2e
```

Clean up the previous test results and reports to avoid confusion or clutter:
```bash
yarn --cwd ../../.. clean
```

## Repo links
- Micro-frontend App: https://github.com/sadrezhao/openmrs-esm-patient-imaging-app
- Imaging frontend (NPM release): https://www.npmjs.com/package/@zhaosadre/esm-patient-imaging-app


# Docker project for the module

This project provides a Docker setup for the OpenMRS 2.x and OpenMRS 3.x Imaging module. It contains all the configuration files and libraries needed to run the application with Orthanc integration in the folder `openmrs-orthanc-docker`. 

> **Note:** Before proceeding, make sure to complete the step in **[Preparing](#preparing)** to install the **Orthanc server** in your environment.


## Configure your local Orthanc server
Update your orthanc setup by replacing and adding the following files:

- Replace/modify the existing `orthanc.json` in `/etc/orthanc` directory with the one from this project and restart the Orthanc server.
> **Note:** Please update the port configuration as follows:
- OpenMRS2.x Docker container -> use port **2222**
- OpenMRS3.x Docker container -> use port **3030**

- Copy the Orthanc worklist script in the `openmrs-orthanc-docker/orthanc` folder: 

    ```bash
    cp orthancWorklist.py /etc/orthanc/
    ```
- Copy the Python plugin configuration:
    ```bash
    cp python.json /etc/orthanc/
    ``` 

## Running the Docker container

### Start the Docker container for OpenMRS 2.x:
  - Go to the folder `openmrs-orthanc-docker`
  ```bash
  docker compose -f docker-compose-openmrs2.yml up
  ```
> **Note**
  - The installation process may take some time.
  - In some cases, you may need to stop the container and restart it to complete the setup successfully.
  - You may experience display issues within the application after importing the new module into Docker or updating to a new release. To resolve these issues, follow these steps:
    - Stop the containers: 
      - For **OpenMRS2.x**: `docker compose -f docker-compose-openmrs2.yml down`
    - Restart the containers: 
      - For **OpenMRS2.x**: `docker compose -f docker-compose-openmrs2.yml up`

    - If problems persist, clear your browser data:
        - Cookies and site data (e.g., 134 MB)
        - Cached files and pages (e.g., 393 MB)

### Login to **OpenMRSMRS 2.x**
- User: **admin**
- Password: use the dedicated non-production credential supplied out of band.
> **Note**: Never document or reuse an administrative password in this repository:
  - Use the password `test` to log in.
  - After logging in, go to your `Admin account` settings OpenMRS and change the password.

### Start the Docker container for OpenMRS 3.x:
  - Go to the folder `openmrs-orthanc-docker` and run
  ```bash
  docker-compose up
  ```
  > **Note**
  - The installation process may take some time. You can monitor the progress of the setup by visiting
  ```bash
  http://localhost:3030/openmrs/initialsetup
  ```

  ![Installation](figures/installProcess.png)

  - In some cases, you may need to stop the container and restart it to complete the setup successfully.

  - Remove the container
  ```bash
  docker-compose down    
  ```
  #### Starting OpenMRS with the imaging module
  You have two options for running the Imaging module:

  - Running via Docker (micro-frontend 3 image)

    - Start the micro-frontend 3:
      ```bash
      http://localhost/openmrs/spa
      ```
    - Validate backend connection:
      ```bash
      http://localhost:3030/openmrs/
      ```

    > **Note** 
    
    You may experience display issues within the application after importing the new module into Docker or updating to a new release. To resolve these issues, follow these steps:
    - Stop the containers: `docker-compose down`
    - Restart the containers: `docker-compose up`
    - If problems persist, clear your browser data:
      - Cookies and site data (e.g., 134 MB)
      - Cached files and pages (e.g., 393 MB)

  - Running the frontend locally (using Docker backend)

    You can run run the micro-frontend on your local machine while connecting to the OpenMRS backend running in Docker. Go to the folder `openmrs-orthanc/openmrs-orthanc-frontend` and run:
    ```bash
    yarn install
    npm start -- --backend http://localhost:3030/
    ```
### Login to **OpenMRS 3.x**
    - User: **admin**
    - Password: use the dedicated non-production credential supplied out of band.

## Orthanc configuration in OpenMRS
To connect with Orthanc, add the following configuration:

- **URL**: `http://host.docker.internal:ORTHANC_PORT` 
  > **Note**: Not change `host.docker.internal`
- **Proxy URL**: `Your local orthanc URL`
- **User**: `orthanc`
- **Password**: `orthanc`

![Orthanc Configuration](figures/orthancConfiguration.png)

## Upload the imaging module
Once the application is running, you will need to upload the required OpenMRS modules from the `openmrs-orthanc-docker/modules` folder within this project:
- imaging-1.1.5-SNAPSHOT.omod

Link: http://localhost:8080/openmrs/admin/modules/module.list#markAllAsRead

> **Note:** You need to click `Start All` to update all modules.

## Deploy the new version of the micro-frontend application to Docker

1. Copy all the files in the `dist` folder from `openmrs-orthanc-frontend` to `openmrs-orthanc-docker/imaging`.
1. Rename the folder from `dist` to `openmrs-esm-patient-imaging-app-NewVersion`
1. Update `importmap.json`:
  Change `"@zhaosadre/esm-patient-imaging-app": "./openmrs-esm-patient-imaging-app-NewVersion/openmrs-esm-patient-imaging-app.js"` to `"@zhaosadre/esm-patient-imaging-app": "./openmrs-esm-patient-imaging-app-newVersionNumber/openmrs-esm-patient-imaging-app.js"`.
1. Update `routes.registry.json`:
1. Update `spa-assemble-config.json`:
  - Copy the contents of the `routes.json` in the `openmrs-orthanc-frontend/src/`
  - Replace the `@zhaosadre/esm-patient-imaging-app: { ... , version": "NewVersion"}`
1. Remove the old Docker container with the command: `docker compose down`
1. Run the new Docker container: `docker compose up`

### Repo link
- Docker project: https://github.com/sadrezhao/openmrs-imaging-docker
