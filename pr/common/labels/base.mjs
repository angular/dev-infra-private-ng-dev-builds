export const createTypedObject = (LabelConstructor) => {
    return (val) => {
        for (const key in val) {
            val[key] = new LabelConstructor(val[key]);
        }
        return val;
    };
};
export class Label {
    constructor(params) {
        this.params = params;
        /** The repositories the label is to be used in. */
        this.repositories = this.params.repositories || [
            ManagedRepositories.ANGULAR,
            ManagedRepositories.ANGULAR_CLI,
            ManagedRepositories.COMPONENTS,
            ManagedRepositories.DEV_INFRA,
        ];
        /* The label string. */
        this.name = this.params.name;
        /* The label description. */
        this.description = this.params.description;
        /* The hexadecimal color code for the label, without the leading */
        this.color = this.params.color;
    }
}
export var ManagedRepositories;
(function (ManagedRepositories) {
    ManagedRepositories["COMPONENTS"] = "components";
    ManagedRepositories["ANGULAR"] = "angular";
    ManagedRepositories["ANGULAR_CLI"] = "angular-cli";
    ManagedRepositories["DEV_INFRA"] = "dev-infra";
})(ManagedRepositories || (ManagedRepositories = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL25nLWRldi9wci9jb21tb24vbGFiZWxzL2Jhc2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxDQUFDLE1BQU0saUJBQWlCLEdBQUcsQ0FBc0MsZ0JBQW1CLEVBQUUsRUFBRTtJQUM1RixPQUFPLENBQUMsR0FBcUQsRUFBRSxFQUFFO1FBQy9ELEtBQUssTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7WUFDdEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELE9BQU8sR0FBc0QsQ0FBQztJQUNoRSxDQUFDLENBQUM7QUFDSixDQUFDLENBQUM7QUFhRixNQUFNLE9BQU8sS0FBSztJQWVoQixZQUE0QixNQUFTO1FBQVQsV0FBTSxHQUFOLE1BQU0sQ0FBRztRQWRyQyxtREFBbUQ7UUFDbkQsaUJBQVksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksSUFBSTtZQUN6QyxtQkFBbUIsQ0FBQyxPQUFPO1lBQzNCLG1CQUFtQixDQUFDLFdBQVc7WUFDL0IsbUJBQW1CLENBQUMsVUFBVTtZQUM5QixtQkFBbUIsQ0FBQyxTQUFTO1NBQzlCLENBQUM7UUFDRix1QkFBdUI7UUFDdkIsU0FBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ3hCLDRCQUE0QjtRQUM1QixnQkFBVyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDO1FBQ3RDLG1FQUFtRTtRQUNuRSxVQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFFYyxDQUFDO0NBQzFDO0FBRUQsTUFBTSxDQUFOLElBQVksbUJBS1g7QUFMRCxXQUFZLG1CQUFtQjtJQUM3QixnREFBeUIsQ0FBQTtJQUN6QiwwQ0FBbUIsQ0FBQTtJQUNuQixrREFBMkIsQ0FBQTtJQUMzQiw4Q0FBdUIsQ0FBQTtBQUN6QixDQUFDLEVBTFcsbUJBQW1CLEtBQW5CLG1CQUFtQixRQUs5QiIsInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBjcmVhdGVUeXBlZE9iamVjdCA9IDxUIGV4dGVuZHMgbmV3ICguLi5hcmdzOiBhbnkpID0+IGFueT4oTGFiZWxDb25zdHJ1Y3RvcjogVCkgPT4ge1xuICByZXR1cm4gKHZhbDogUmVjb3JkPFByb3BlcnR5S2V5LCBDb25zdHJ1Y3RvclBhcmFtZXRlcnM8VD5bMF0+KSA9PiB7XG4gICAgZm9yIChjb25zdCBrZXkgaW4gdmFsKSB7XG4gICAgICB2YWxba2V5XSA9IG5ldyBMYWJlbENvbnN0cnVjdG9yKHZhbFtrZXldKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbCBhcyB1bmtub3duIGFzIFJlY29yZDxQcm9wZXJ0eUtleSwgSW5zdGFuY2VUeXBlPFQ+PjtcbiAgfTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFiZWxQYXJhbXMge1xuICAvKiBUaGUgbGFiZWwgc3RyaW5nLiAqL1xuICBuYW1lOiBzdHJpbmc7XG4gIC8qIFRoZSBsYWJlbCBkZXNjcmlwdGlvbi4gKi9cbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgLyogVGhlIGhleGFkZWNpbWFsIGNvbG9yIGNvZGUgZm9yIHRoZSBsYWJlbCwgd2l0aG91dCB0aGUgbGVhZGluZyAqL1xuICBjb2xvcj86IHN0cmluZztcbiAgLyoqIFRoZSByZXBvc2l0b3JpZXMgdGhlIGxhYmVsIGlzIHRvIGJlIHVzZWQgaW4uICovXG4gIHJlcG9zaXRvcmllcz86IE1hbmFnZWRSZXBvc2l0b3JpZXNbXTtcbn1cblxuZXhwb3J0IGNsYXNzIExhYmVsPFQgZXh0ZW5kcyBMYWJlbFBhcmFtcyA9IExhYmVsUGFyYW1zPiB7XG4gIC8qKiBUaGUgcmVwb3NpdG9yaWVzIHRoZSBsYWJlbCBpcyB0byBiZSB1c2VkIGluLiAqL1xuICByZXBvc2l0b3JpZXMgPSB0aGlzLnBhcmFtcy5yZXBvc2l0b3JpZXMgfHwgW1xuICAgIE1hbmFnZWRSZXBvc2l0b3JpZXMuQU5HVUxBUixcbiAgICBNYW5hZ2VkUmVwb3NpdG9yaWVzLkFOR1VMQVJfQ0xJLFxuICAgIE1hbmFnZWRSZXBvc2l0b3JpZXMuQ09NUE9ORU5UUyxcbiAgICBNYW5hZ2VkUmVwb3NpdG9yaWVzLkRFVl9JTkZSQSxcbiAgXTtcbiAgLyogVGhlIGxhYmVsIHN0cmluZy4gKi9cbiAgbmFtZSA9IHRoaXMucGFyYW1zLm5hbWU7XG4gIC8qIFRoZSBsYWJlbCBkZXNjcmlwdGlvbi4gKi9cbiAgZGVzY3JpcHRpb24gPSB0aGlzLnBhcmFtcy5kZXNjcmlwdGlvbjtcbiAgLyogVGhlIGhleGFkZWNpbWFsIGNvbG9yIGNvZGUgZm9yIHRoZSBsYWJlbCwgd2l0aG91dCB0aGUgbGVhZGluZyAqL1xuICBjb2xvciA9IHRoaXMucGFyYW1zLmNvbG9yO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBwYXJhbXM6IFQpIHt9XG59XG5cbmV4cG9ydCBlbnVtIE1hbmFnZWRSZXBvc2l0b3JpZXMge1xuICBDT01QT05FTlRTID0gJ2NvbXBvbmVudHMnLFxuICBBTkdVTEFSID0gJ2FuZ3VsYXInLFxuICBBTkdVTEFSX0NMSSA9ICdhbmd1bGFyLWNsaScsXG4gIERFVl9JTkZSQSA9ICdkZXYtaW5mcmEnLFxufVxuIl19